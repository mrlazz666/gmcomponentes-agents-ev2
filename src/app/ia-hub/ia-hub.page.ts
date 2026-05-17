import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CatalogContextService } from '../services/catalog-context.service';
import { FaqService } from '../services/faq.service';
import { RecommendationService } from '../services/recommendation.service';
import { ProductLite } from '../models/ai-core.models';
import { FaqResponse } from '../models/faq.models';
import {
  RecommendationResponse,
  RecommendationState,
  RecommendationStep,
} from '../models/recommendation.models';
import { AgentService } from '../services/agent.service';
import { AgentChatResponse } from '../models/agent.model';

type ChatRole = 'assistant' | 'user';

interface ChatMessage {
  role: ChatRole;
  text: string;
}

type AgentMode = 'faq' | 'recommendation';
type AgentRecommendationStep =
  | 'initial'
  | 'category'
  | 'brand'
  | 'use'
  | 'priority'
  | 'done';
type AgentRecommendationStageKey = AgentRecommendationStep | 'budget';

interface AgentStage {
  key: AgentRecommendationStageKey;
  label: string;
  helper: string;
}

@Component({
  selector: 'app-ia-hub',
  templateUrl: './ia-hub.page.html',
  styleUrls: ['./ia-hub.page.scss'],
})
export class IaHubPage implements OnInit {
  readonly initialAssistantMessage =
    'Cuentame que componente buscas y agrega tu presupuesto en CLP. Sin presupuesto no puedo avanzar a la recomendacion.';

  readonly recommendationPlaceholderByStep: Record<RecommendationStep, string> =
    {
      initial: 'Ejemplo: quiero una grafica para jugar en 4K',
      category: 'Escribe el componente que buscas',
      brand: 'Escribe una marca o responde sin preferencia',
      use: 'Ejemplo: gaming, oficina, edicion, diseno grafico o general',
      priority: 'Elige: calidad, precio o calidad/precio',
      done: 'Describe una nueva necesidad para otra recomendacion',
    };

  readonly recommendationButtonLabelByStep: Record<RecommendationStep, string> =
    {
      initial: 'Comenzar recomendacion',
      category: 'Confirmar componente',
      brand: 'Confirmar marca',
      use: 'Confirmar uso',
      priority: 'Generar recomendacion',
      done: 'Nueva consulta',
    };

  readonly recommendationRankDescriptions = [
    'Esta es la opcion principal que mejor calza con tu necesidad actual.',
    'Esta es una alternativa fuerte para comparar sin perder demasiado rendimiento.',
    'Esta opcion sirve como tercera referencia util para abrir el abanico.',
    'Esta alternativa te ayuda a contrastar precio y rendimiento.',
    'La dejo como respaldo por si quieres comparar una quinta posibilidad.',
  ];

  selectedSegment: 'recommendation' | 'faq' | 'agents' = 'recommendation';
  faqForm!: FormGroup;

  catalog: ProductLite[] = [];
  faqResult: FaqResponse | null = null;
  loading = false;

  agentQuestion = '';
  agentLoading = false;
  agentError = '';
  agentInputWarning = '';
  agentResult: AgentChatResponse | null = null;

  agentMode: AgentMode = 'faq';

  agentRecommendationMessage = '';
  agentRecommendationMessages: ChatMessage[] = [];
  agentRecommendationQuickOptions: string[] = [];
  agentRecommendationSuggestions: ProductLite[] = [];
  agentRecommendationNextStep: AgentRecommendationStep = 'initial';
  agentRecommendationState: Record<string, unknown> | null = null;

  readonly recommendationAgentStages: AgentStage[] = [
    {
      key: 'initial',
      label: 'Necesidad',
      helper: 'Describe que componente necesitas.',
    },
    {
      key: 'budget',
      label: 'Presupuesto',
      helper: 'Ingresa tu presupuesto en CLP.',
    },
    {
      key: 'category',
      label: 'Componente',
      helper: 'Confirma el tipo de componente.',
    },
    {
      key: 'brand',
      label: 'Marca',
      helper: 'Elige marca o sin preferencia.',
    },
    {
      key: 'use',
      label: 'Uso',
      helper: 'Indica gaming, oficina, edicion o general.',
    },
    {
      key: 'priority',
      label: 'Prioridad',
      helper: 'Define calidad, precio o calidad/precio.',
    },
    {
      key: 'done',
      label: 'Resultado',
      helper: 'Recomendacion final generada.',
    },
  ];

  readonly agentSessionId =
    globalThis.crypto?.randomUUID?.() ??
    `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  showAgentTechnicalDetails = false;
  showAgentConversation = false;
  showAgentLongTermMemory = false;

  get agentConversationSummary(): string {
    const turns = Math.max(this.agentRecommendationMessages.length - 1, 0);
    return `${turns} turno(s) registrados en esta recomendacion`;
  }

  get primaryAgentRecommendation(): ProductLite | null {
    return this.agentRecommendationSuggestions[0] || null;
  }

  get secondaryAgentRecommendations(): ProductLite[] {
    return this.agentRecommendationSuggestions.slice(1);
  }

  get agentTechnicalSummary(): string {
    if (!this.agentResult) {
      return 'Sin ejecucion registrada.';
    }

    return `${this.agentResult.intent} | ${this.agentResult.memory_messages} mensajes | ${this.agentResult.used_tools.length} tools`;
  }

  get agentFrameworkName(): string {
    const framework = this.agentResult?.data?.['agent_framework'];

    if (typeof framework === 'string' && framework.trim()) {
      return framework;
    }

    if (this.agentResult?.used_tools?.includes('langchain_core')) {
      return 'LangChain Core StructuredTool';
    }

    return 'Agentes modulares EV2';
  }

  get agentLangChainToolName(): string {
    const tools = this.agentResult?.used_tools || [];
    const langchainTool = tools.find((tool) =>
      tool.startsWith('gm_components_'),
    );

    return langchainTool
      ? this.formatAgentToolName(langchainTool)
      : 'No aplica';
  }

  get agentLangChainFlowSummary(): string {
    if (!this.agentResult) {
      return '';
    }

    if (this.agentResult.intent === 'faq') {
      return 'El FAQ Agent ejecuta una StructuredTool de LangChain que llama al endpoint /api/faq de EV1 y usa el RAG existente como herramienta real.';
    }

    if (this.agentResult.intent === 'recommendation') {
      return 'El Recommendation Agent ejecuta una StructuredTool de LangChain que llama al endpoint /api/recommendation de EV1 y mantiene el flujo por etapas.';
    }

    if (this.agentResult.intent === 'catalog') {
      return 'El Orchestrator puede usar una StructuredTool de LangChain para buscar productos dentro del catalogo recibido.';
    }

    return 'El Orchestrator resolvio la consulta sin ejecutar una tool especializada de LangChain.';
  }

  get agentLongTermMemory(): Record<string, unknown> | null {
    const memory = this.agentResult?.data?.['long_term_memory'];

    if (memory && typeof memory === 'object' && !Array.isArray(memory)) {
      return memory as Record<string, unknown>;
    }

    return null;
  }

  get agentLongTermType(): string {
    const type = this.agentLongTermMemory?.['type'];
    return typeof type === 'string' ? type : 'sin tipo';
  }

  get agentLongTermMatches(): Record<string, unknown>[] {
    const matches = this.agentLongTermMemory?.['matches'];

    if (!Array.isArray(matches)) {
      return [];
    }

    return matches.filter(
      (item): item is Record<string, unknown> =>
        item !== null && typeof item === 'object' && !Array.isArray(item),
    );
  }

  get agentLongTermSavedFact(): Record<string, unknown> | null {
    const savedFact = this.agentLongTermMemory?.['saved_fact'];

    if (
      savedFact &&
      typeof savedFact === 'object' &&
      !Array.isArray(savedFact)
    ) {
      return savedFact as Record<string, unknown>;
    }

    return null;
  }

  get agentLongTermSavedFactText(): string {
    const fact = this.agentLongTermSavedFact?.['fact'];
    return typeof fact === 'string'
      ? fact
      : 'Sin hecho guardado en esta ejecucion.';
  }

  get agentLongTermSummary(): string {
    if (!this.agentLongTermMemory) {
      return 'Sin memoria larga registrada.';
    }

    return `${this.agentLongTermMatches.length} coincidencia(s) recuperadas | tipo ${this.agentLongTermType}`;
  }

  formatLongTermMemoryFact(memory: Record<string, unknown>): string {
    const fact = memory['fact'];
    return typeof fact === 'string' ? fact : 'Memoria sin descripcion.';
  }

  toggleAgentConversation(): void {
    this.showAgentConversation = !this.showAgentConversation;
  }

  toggleAgentTechnicalDetails(): void {
    this.showAgentTechnicalDetails = !this.showAgentTechnicalDetails;
  }

  toggleAgentLongTermMemory(): void {
    this.showAgentLongTermMemory = !this.showAgentLongTermMemory;
  }

  get agentLoadingSteps(): string[] {
    if (this.agentMode === 'recommendation') {
      return [
        'Orchestrator Agent activo',
        'Planner Agent analizando necesidad',
        'Memory Tool recuperando estado conversacional',
        'Recommendation Agent preparando siguiente etapa',
        'Recommendation EV1 Tool consultando recomendador',
      ];
    }

    return [
      'Orchestrator Agent activo',
      'Planner Agent analizando intencion',
      'Memory Tool recuperando contexto',
      'FAQ Agent preparando consulta',
      'FAQ/RAG EV1 Tool recuperando evidencia',
    ];
  }

  setAgentMode(mode: AgentMode): void {
    if (this.agentMode === mode) {
      return;
    }

    this.agentMode = mode;
    this.agentError = '';
    this.agentInputWarning = '';
    this.agentResult = null;
    this.showAgentLoadingPanel = false;

    if (
      mode === 'recommendation' &&
      this.agentRecommendationMessages.length === 0
    ) {
      this.resetAgentRecommendationFlow();
    }
  }

  resetAgentRecommendationFlow(): void {
    this.agentRecommendationMessage = '';
    this.agentRecommendationMessages = [
      {
        role: 'assistant',
        text: 'Describe que componente necesitas. El Recommendation Agent te guiara por presupuesto, marca, uso y prioridad.',
      },
    ];
    this.agentRecommendationQuickOptions = [];
    this.agentRecommendationSuggestions = [];
    this.agentRecommendationNextStep = 'initial';
    this.agentRecommendationState = null;
    this.agentResult = null;
    this.agentError = '';
    this.agentInputWarning = '';
  }

  get currentRecommendationStageKey(): AgentRecommendationStageKey {
    const answer = (this.agentResult?.answer || '').toLowerCase();

    if (
      this.agentRecommendationNextStep === 'initial' &&
      (answer.includes('presupuesto') ||
        this.agentRecommendationMessages.length > 1)
    ) {
      return 'budget';
    }

    return this.agentRecommendationNextStep;
  }

  get activeRecommendationAgentStage(): AgentStage {
    return (
      this.recommendationAgentStages.find(
        (stage) => stage.key === this.currentRecommendationStageKey,
      ) || this.recommendationAgentStages[0]
    );
  }

  get agentRecommendationPlaceholder(): string {
    const placeholders: Record<AgentRecommendationStageKey, string> = {
      initial: 'Ejemplo: quiero una grafica',
      budget: 'Ejemplo: 500000',
      category: 'Ejemplo: tarjeta grafica, procesador, memoria RAM',
      brand: 'Ejemplo: NVIDIA, AMD o sin preferencia',
      use: 'Ejemplo: gaming, oficina, edicion o general',
      priority: 'Ejemplo: precio, calidad o calidad/precio',
      done: 'Flujo finalizado. Reinicia para una nueva recomendacion.',
    };

    return placeholders[this.currentRecommendationStageKey];
  }

  get agentRecommendationButtonLabel(): string {
    if (this.agentRecommendationNextStep === 'done') {
      return 'Nueva recomendacion';
    }

    return this.agentLoading
      ? 'Ejecutando agentes...'
      : 'Enviar al Recommendation Agent';
  }

  isAgentStageDone(stage: AgentStage): boolean {
    if (this.agentRecommendationNextStep === 'done') {
      return true;
    }

    const currentIndex = this.recommendationAgentStages.findIndex(
      (item) => item.key === this.currentRecommendationStageKey,
    );
    const stageIndex = this.recommendationAgentStages.findIndex(
      (item) => item.key === stage.key,
    );

    return currentIndex > stageIndex;
  }

  selectAgentRecommendationOption(option: string): void {
    this.agentRecommendationMessage = option;
    this.submitAgentRecommendation();
  }

  submitActiveAgent(): void {
    if (this.agentMode === 'recommendation') {
      this.submitAgentRecommendation();
      return;
    }

    this.submitAgentFaq();
  }

  private buildAgentRecommendationAnswer(response: AgentChatResponse): string {
    const data = response.data || {};
    const mode = data['mode'];
    const suggestions = (data['suggestions'] as ProductLite[]) || [];

    if (
      response.intent !== 'recommendation' ||
      mode !== 'result' ||
      !suggestions.length
    ) {
      return response.answer || 'No pude generar una respuesta en este turno.';
    }

    const primary = suggestions[0];
    const alternatives = suggestions.slice(1);

    const primaryName = `${primary.nombre} ${primary.descripcion}`.trim();
    const primaryPrice = primary.precio
      ? primary.precio.toLocaleString('es-CL')
      : 'precio no disponible';

    const lines = [
      'Recomendacion final generada por Recommendation Agent.',
      `Producto principal: ${primaryName}.`,
      `Precio: $${primaryPrice}. Stock: ${primary.stock}.`,
    ];

    if (alternatives.length) {
      lines.push(
        `Tambien deje ${alternatives.length} alternativa(s) para comparar en el resumen final.`,
      );
    }

    return lines.join('\n');
  }

  submitAgentRecommendation(): void {
    if (this.agentRecommendationNextStep === 'done') {
      this.showAgentTechnicalDetails = false;
      this.resetAgentRecommendationFlow();
      return;
    }

    const text = this.agentRecommendationMessage.trim();

    if (!text) {
      return;
    }

    this.agentLoading = true;
    this.agentError = '';
    this.agentInputWarning = '';
    this.agentResult = null;
    this.startAgentLoadingPanel();

    this.agentRecommendationMessages = [
      ...this.agentRecommendationMessages,
      { role: 'user', text },
    ];

    this.agentService
      .chatAgent({
        session_id: this.agentSessionId,
        message: `/rec ${text}`,
        user: this.usuario,
        products: this.catalog,
      })
      .subscribe({
        next: (response) => {
          setTimeout(() => {
            const data = response.data || {};
            const nextStep =
              (data['nextStep'] as AgentRecommendationStep) || 'done';
            const quickOptions = (data['quickOptions'] as string[]) || [];
            const suggestions = (data['suggestions'] as ProductLite[]) || [];
            const state = (data['state'] as Record<string, unknown>) || null;

            this.agentResult = response;
            this.agentRecommendationMessages = [
              ...this.agentRecommendationMessages,
              {
                role: 'assistant',
                text: this.buildAgentRecommendationAnswer(response),
              },
            ];

            this.agentRecommendationNextStep = nextStep;
            this.agentRecommendationQuickOptions = quickOptions;
            this.agentRecommendationSuggestions = suggestions;
            this.agentRecommendationState = state;
            this.agentRecommendationMessage = '';
            this.agentLoading = false;
            this.stopAgentLoadingPanel();
          }, 900);
        },
        error: (error) => {
          console.error('Error consultando Recommendation Agent EV2:', error);

          setTimeout(() => {
            this.agentLoading = false;
            this.stopAgentLoadingPanel();
            this.agentError =
              'No fue posible conectar con Recommendation Agent EV2. Revisa FastAPI, Node y el endpoint de recomendacion EV1.';
          }, 900);
        },
      });
  }

  activeAgentLoadingStep = 0;
  showAgentLoadingPanel = false;
  private agentLoadingInterval?: ReturnType<typeof setInterval>;

  private startAgentLoadingPanel(): void {
    this.showAgentLoadingPanel = true;
    this.activeAgentLoadingStep = 0;

    if (this.agentLoadingInterval) {
      clearInterval(this.agentLoadingInterval);
    }

    this.agentLoadingInterval = setInterval(() => {
      if (this.activeAgentLoadingStep < this.agentLoadingSteps.length - 1) {
        this.activeAgentLoadingStep += 1;
      }
    }, 550);
  }

  readonly faqAgentFlow = [
    {
      name: 'Orchestrator Agent',
      role: 'Recibe la consulta, revisa la memoria y decide que agente debe responder.',
      status: 'Coordina',
    },
    {
      name: 'Planner Agent',
      role: 'Clasifica la intencion como FAQ y genera el plan de ejecucion.',
      status: 'Planifica',
    },
    {
      name: 'FAQ Agent',
      role: 'Usa el RAG de la EV1 como herramienta real para responder con evidencia.',
      status: 'Ejecuta',
    },
  ];

  readonly faqToolFlow = [
    {
      name: 'Memory Tool',
      role: 'Registra el turno del usuario y la respuesta del agente por session_id.',
    },
    {
      name: 'FAQ/RAG EV1 Tool',
      role: 'Llama al endpoint /api/faq del backend EV1 y recupera producto destacado, relacionados y sugerencias.',
    },
  ];

  formatAgentToolName(tool: string): string {
    const labels: Record<string, string> = {
      planner_agent: 'Planner Agent',
      memory_tool: 'Memory Tool',
      faq_tool_ev1_rag: 'FAQ/RAG EV1 Tool',
      recommendation_tool_ev1: 'Recommendation EV1 Tool',
      catalog_tool: 'Catalog Tool',
      langchain_core: 'LangChain Core',
      gm_components_faq_rag_ev1: 'LangChain Tool: FAQ/RAG EV1',
      gm_components_recommendation_ev1: 'LangChain Tool: Recommendation EV1',
      gm_components_catalog_search: 'LangChain Tool: Catalog Search',
      long_term_memory_tool: 'Long-Term Memory Tool',
    };

    return labels[tool] || tool;
  }

  get agentDecisionSummary(): string {
    if (!this.agentResult) {
      return '';
    }

    if (this.agentResult.intent === 'faq') {
      return 'El orquestador detecto una consulta FAQ y derivo la tarea al FAQ Agent, que uso el RAG de la EV1 como herramienta.';
    }

    if (this.agentResult.intent === 'recommendation') {
      return 'El orquestador detecto una solicitud de recomendacion y derivo la tarea al Recommendation Agent.';
    }

    if (this.agentResult.intent === 'catalog') {
      return 'El orquestador detecto una busqueda de catalogo y uso la herramienta de catalogo.';
    }

    return 'El orquestador no detecto una intencion especializada y respondio con una orientacion general.';
  }

  private stopAgentLoadingPanel(): void {
    if (this.agentLoadingInterval) {
      clearInterval(this.agentLoadingInterval);
      this.agentLoadingInterval = undefined;
    }

    setTimeout(() => {
      this.showAgentLoadingPanel = false;
      this.activeAgentLoadingStep = 0;
    }, 450);
  }

  private validateAgentFaqQuestion(question: string): string {
    const trimmed = question.trim();

    if (trimmed.length < 3) {
      return 'Escribe una pregunta un poco mas completa para que los agentes puedan analizarla.';
    }

    const letters = trimmed.match(/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/g) || [];
    const digits = trimmed.match(/\d/g) || [];
    const usefulChars = letters.length + digits.length;
    const symbolChars = trimmed.replace(
      /[a-zA-ZáéíóúÁÉÍÓÚñÑ0-9\s]/g,
      '',
    ).length;

    const readableWords = trimmed
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => /^[a-zA-ZáéíóúÁÉÍÓÚñÑ0-9]+$/.test(word));

    const productModelLike =
      /\b(rtx|gtx|rx|ryzen|intel|core|ddr4|ddr5|b550|x570|z790|h510)\b/i.test(
        trimmed,
      );

    if (usefulChars === 0) {
      return 'La consulta contiene solo simbolos. Escribe una pregunta sobre stock, productos, despacho o garantia.';
    }

    if (symbolChars > 0 && readableWords.length === 0 && !productModelLike) {
      return 'La consulta no parece tener palabras legibles. Revisa signos o simbolos antes de enviarla al agente.';
    }

    if (symbolChars > usefulChars) {
      return 'La consulta tiene demasiados simbolos. Revisa el texto antes de enviarlo al agente.';
    }

    if (letters.length < 2 && digits.length < 2) {
      return 'La consulta es demasiado ambigua. Agrega una palabra o modelo de producto, por ejemplo RTX 4060.';
    }

    return '';
  }

  recommendationMessages: ChatMessage[] = [];
  recommendationMessage = '';
  recommendationBudget = '';
  recommendationBudgetError = '';
  recommendationLoading = false;
  recommendationState: RecommendationState = { baseRequest: '' };
  recommendationStep: RecommendationStep = 'initial';
  recommendationQuickOptions: string[] = [];
  recommendationSuggestions: ProductLite[] = [];
  activeRecommendationIndex = 0;
  readonly recommendationSessionId =
    globalThis.crypto?.randomUUID?.() ??
    `rec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  constructor(
    private fb: FormBuilder,
    private catalogContextService: CatalogContextService,
    private faqService: FaqService,
    private recommendationService: RecommendationService,
    private agentService: AgentService,
  ) {}

  ngOnInit(): void {
    this.faqForm = this.fb.group({
      pregunta: ['', Validators.required],
    });

    this.resetRecommendationConversation();
    this.loadCatalog();
  }

  loadCatalog(): void {
    this.catalogContextService.getCatalog().subscribe({
      next: (products) => {
        this.catalog = products;
      },
      error: (error) => {
        console.error('Error cargando catalogo para la IA:', error);
      },
    });
  }

  get usuario() {
    return {
      correo: sessionStorage.getItem('correo') || 'demo@gmcomponents.cl',
      nombre: sessionStorage.getItem('nombre') || 'Usuario Demo',
      rol: 'cliente' as const,
    };
  }

  get activeRecommendationProduct(): ProductLite | null {
    return (
      this.recommendationSuggestions[this.activeRecommendationIndex] || null
    );
  }

  get activeRecommendationCopy() {
    const product = this.activeRecommendationProduct;
    if (!product) {
      return null;
    }

    return {
      title:
        product.rankLabel ||
        `Recomendacion ${this.activeRecommendationIndex + 1}`,
      subtitle:
        this.recommendationRankDescriptions[this.activeRecommendationIndex] ||
        'Esta es una recomendacion valida segun tu consulta.',
      body:
        product.recommendationNote ||
        'Te la muestro como una opcion valida segun el presupuesto, el uso y la prioridad que indicaste.',
    };
  }

  get formattedRecommendationBudget(): string {
    const resolvedBudget =
      this.recommendationState.budget ||
      this.parseBudgetValue(this.recommendationBudget);
    return resolvedBudget
      ? `$${resolvedBudget.toLocaleString('es-CL')}`
      : 'Presupuesto obligatorio';
  }

  get recommendationSummaryChips(): string[] {
    const chips: string[] = [this.formattedRecommendationBudget];

    if (this.recommendationState.category) {
      chips.push(this.recommendationState.category);
    }

    if (
      this.recommendationState.preferredBrand &&
      !this.recommendationState.anyBrand
    ) {
      chips.push(this.recommendationState.preferredBrand);
    }

    if (this.recommendationState.anyBrand) {
      chips.push('Marcas generales');
    }

    if (this.recommendationState.useCase) {
      chips.push(
        this.capitalizeRecommendationValue(this.recommendationState.useCase),
      );
    }

    if (this.recommendationState.priority) {
      chips.push(
        this.capitalizeRecommendationValue(this.recommendationState.priority),
      );
    }

    return chips;
  }

  submitAgentFaq(): void {
    const question = this.agentQuestion.trim();

    if (!question) {
      return;
    }

    this.agentInputWarning = this.validateAgentFaqQuestion(question);

    if (this.agentInputWarning) {
      this.agentResult = null;
      this.agentError = '';
      this.agentLoading = false;
      this.showAgentLoadingPanel = false;
      return;
    }

    this.showAgentTechnicalDetails = false;

    this.agentLoading = true;
    this.agentError = '';
    this.agentInputWarning = '';
    this.agentResult = null;

    this.startAgentLoadingPanel();
    this.showAgentConversation = false;

    this.agentService
      .chatAgent({
        session_id: this.agentSessionId,
        message: `/faq ${question}`,
        user: this.usuario,
        products: [],
      })
      .subscribe({
        next: (response) => {
          setTimeout(() => {
            this.agentResult = response;
            this.agentLoading = false;
            this.stopAgentLoadingPanel();
          }, 900);
        },
        error: (error) => {
          console.error('Error consultando agente EV2:', error);

          setTimeout(() => {
            this.agentLoading = false;
            this.stopAgentLoadingPanel();
            this.agentError =
              'No fue posible conectar con la capa de agentes EV2. Revisa que FastAPI este activo en el puerto 8790.';
          }, 900);
        },
      });
  }

  submitFaq(): void {
    if (this.faqForm.invalid) {
      this.faqForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.faqResult = null;

    this.faqService
      .askFaq({
        mode: 'faq',
        usuario: this.usuario,
        pregunta: this.faqForm.value.pregunta,
        productos: this.catalog,
      })
      .subscribe({
        next: (response) => {
          this.faqResult = response;
          this.loading = false;
        },
        error: (error) => {
          console.error(error);
          this.loading = false;
          alert('No fue posible responder la consulta.');
        },
      });
  }

  submitRecommendation(): void {
    if (this.recommendationStep === 'done') {
      this.resetRecommendationConversation();
      return;
    }

    const text = this.recommendationMessage.trim();
    if (!text) {
      return;
    }

    const resolvedBudget =
      this.recommendationState.budget ||
      this.parseBudgetValue(this.recommendationBudget);
    if (
      this.recommendationStep === 'initial' &&
      (!resolvedBudget || resolvedBudget <= 0)
    ) {
      this.recommendationBudgetError =
        'Debes ingresar tu presupuesto en CLP para continuar.';
      this.trackRecommendationFrontendEvent('budget_validation_failed', {
        message: text,
        step: this.recommendationStep,
      });
      this.appendAssistantMessageIfNeeded(
        'Necesito tu presupuesto en CLP para continuar con la recomendacion.',
      );
      return;
    }

    this.recommendationBudgetError = '';
    this.recommendationLoading = true;
    this.recommendationMessages = [
      ...this.recommendationMessages,
      { role: 'user', text },
    ];
    this.trackRecommendationFrontendEvent('message_submitted', {
      message: text,
      budget: resolvedBudget || null,
      step: this.recommendationStep,
      state: this.recommendationState,
    });

    this.recommendationService
      .chatRecommendation({
        message: text,
        budget: resolvedBudget,
        step: this.recommendationStep,
        state:
          this.recommendationStep === 'initial'
            ? undefined
            : this.recommendationState,
        productos: this.catalog,
      })
      .subscribe({
        next: (response: RecommendationResponse) => {
          this.recommendationMessages = [
            ...this.recommendationMessages,
            {
              role: 'assistant',
              text: response.answer || 'No pude responder en este intento.',
            },
          ];
          this.recommendationState = response.state || {
            baseRequest: text,
            budget: resolvedBudget,
          };
          this.recommendationStep = response.nextStep || 'done';
          this.recommendationQuickOptions = response.quickOptions || [];
          this.recommendationSuggestions =
            response.mode === 'result' ? response.suggestions || [] : [];
          this.activeRecommendationIndex = 0;
          this.recommendationMessage = '';
          this.recommendationLoading = false;
          this.trackRecommendationFrontendEvent('response_received', {
            mode: response.mode,
            nextStep: response.nextStep || 'done',
            quickOptions: response.quickOptions || [],
            suggestionsCount: (response.suggestions || []).length,
            confidence: response.confidence ?? null,
            aiContext: response.aiContext || null,
          });
        },
        error: (error) => {
          console.error(error);
          this.recommendationLoading = false;
          this.trackRecommendationFrontendEvent('response_error', {
            message: text,
            step: this.recommendationStep,
          });
          this.appendAssistantMessageIfNeeded(
            'No fue posible generar la recomendacion en este momento. Intenta nuevamente.',
          );
        },
      });
  }

  selectRecommendationOption(option: string): void {
    this.trackRecommendationFrontendEvent('quick_option_selected', {
      option,
      step: this.recommendationStep,
    });
    this.recommendationMessage = option;
    this.submitRecommendation();
  }

  resetRecommendationConversation(): void {
    if (
      this.recommendationMessages.length > 0 ||
      this.recommendationSuggestions.length > 0
    ) {
      this.trackRecommendationFrontendEvent('conversation_reset', {
        step: this.recommendationStep,
        state: this.recommendationState,
        suggestionsCount: this.recommendationSuggestions.length,
      });
    }
    this.recommendationMessages = [
      { role: 'assistant', text: this.initialAssistantMessage },
    ];
    this.recommendationMessage = '';
    this.recommendationBudget = '';
    this.recommendationBudgetError = '';
    this.recommendationState = { baseRequest: '' };
    this.recommendationStep = 'initial';
    this.recommendationQuickOptions = [];
    this.recommendationSuggestions = [];
    this.activeRecommendationIndex = 0;
  }

  goToPreviousRecommendation(): void {
    if (this.recommendationSuggestions.length <= 1) {
      return;
    }

    const nextIndex =
      this.activeRecommendationIndex === 0
        ? this.recommendationSuggestions.length - 1
        : this.activeRecommendationIndex - 1;
    this.trackRecommendationFrontendEvent('carousel_previous_clicked', {
      fromIndex: this.activeRecommendationIndex,
      toIndex: nextIndex,
    });

    this.activeRecommendationIndex =
      this.activeRecommendationIndex === 0
        ? this.recommendationSuggestions.length - 1
        : this.activeRecommendationIndex - 1;
  }

  goToNextRecommendation(): void {
    if (this.recommendationSuggestions.length <= 1) {
      return;
    }

    const nextIndex =
      this.activeRecommendationIndex ===
      this.recommendationSuggestions.length - 1
        ? 0
        : this.activeRecommendationIndex + 1;
    this.trackRecommendationFrontendEvent('carousel_next_clicked', {
      fromIndex: this.activeRecommendationIndex,
      toIndex: nextIndex,
    });

    this.activeRecommendationIndex =
      this.activeRecommendationIndex ===
      this.recommendationSuggestions.length - 1
        ? 0
        : this.activeRecommendationIndex + 1;
  }

  setActiveRecommendation(index: number): void {
    this.trackRecommendationFrontendEvent('carousel_thumb_clicked', {
      fromIndex: this.activeRecommendationIndex,
      toIndex: index,
    });
    this.activeRecommendationIndex = index;
  }

  formatBudgetInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    const digits = String(target.value || '').replace(/\D/g, '');
    this.recommendationBudget = digits
      ? `$${Number.parseInt(digits, 10).toLocaleString('es-CL')}`
      : '';

    if (this.parseBudgetValue(this.recommendationBudget)) {
      this.recommendationBudgetError = '';
      this.trackRecommendationFrontendEvent('budget_updated', {
        budget: this.parseBudgetValue(this.recommendationBudget),
      });
    }
  }

  private parseBudgetValue(value: string): number | undefined {
    const digits = String(value || '').replace(/\D/g, '');
    return digits ? Number.parseInt(digits, 10) : undefined;
  }

  private appendAssistantMessageIfNeeded(text: string): void {
    const last =
      this.recommendationMessages[this.recommendationMessages.length - 1];
    if (last && last.role === 'assistant' && last.text === text) {
      return;
    }

    this.recommendationMessages = [
      ...this.recommendationMessages,
      { role: 'assistant', text },
    ];
  }

  private capitalizeRecommendationValue(value: string): string {
    if (!value) {
      return '';
    }

    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  private trackRecommendationFrontendEvent(
    event: string,
    payload: Record<string, unknown>,
  ): void {
    this.recommendationService
      .logFrontendEvent({
        event,
        sessionId: this.recommendationSessionId,
        payload,
      })
      .subscribe({
        error: (error) => {
          console.error(
            'No fue posible guardar telemetry de recommendation:',
            error,
          );
        },
      });
  }
}
