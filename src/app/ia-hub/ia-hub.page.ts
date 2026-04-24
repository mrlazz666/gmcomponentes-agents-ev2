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
  RecommendationStep
} from '../models/recommendation.models';

type ChatRole = 'assistant' | 'user';

interface ChatMessage {
  role: ChatRole;
  text: string;
}

@Component({
  selector: 'app-ia-hub',
  templateUrl: './ia-hub.page.html',
  styleUrls: ['./ia-hub.page.scss']
})
export class IaHubPage implements OnInit {
  readonly initialAssistantMessage =
    'Cuentame que componente buscas y agrega tu presupuesto en CLP. Sin presupuesto no puedo avanzar a la recomendacion.';

  readonly recommendationPlaceholderByStep: Record<RecommendationStep, string> = {
    initial: 'Ejemplo: quiero una grafica para jugar en 4K',
    category: 'Escribe el componente que buscas',
    brand: 'Escribe una marca o responde sin preferencia',
    use: 'Ejemplo: gaming, oficina, edicion, diseno grafico o general',
    priority: 'Elige: calidad, precio o calidad/precio',
    done: 'Describe una nueva necesidad para otra recomendacion'
  };

  readonly recommendationButtonLabelByStep: Record<RecommendationStep, string> = {
    initial: 'Comenzar recomendacion',
    category: 'Confirmar componente',
    brand: 'Confirmar marca',
    use: 'Confirmar uso',
    priority: 'Generar recomendacion',
    done: 'Nueva consulta'
  };

  readonly recommendationRankDescriptions = [
    'Esta es la opcion principal que mejor calza con tu necesidad actual.',
    'Esta es una alternativa fuerte para comparar sin perder demasiado rendimiento.',
    'Esta opcion sirve como tercera referencia util para abrir el abanico.',
    'Esta alternativa te ayuda a contrastar precio y rendimiento.',
    'La dejo como respaldo por si quieres comparar una quinta posibilidad.'
  ];

  selectedSegment: 'recommendation' | 'faq' = 'recommendation';
  faqForm!: FormGroup;

  catalog: ProductLite[] = [];
  faqResult: FaqResponse | null = null;
  loading = false;

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

  constructor(
    private fb: FormBuilder,
    private catalogContextService: CatalogContextService,
    private faqService: FaqService,
    private recommendationService: RecommendationService
  ) {}

  ngOnInit(): void {
    this.faqForm = this.fb.group({
      pregunta: ['', Validators.required]
    });

    this.resetRecommendationConversation();
    this.loadCatalog();
  }

  loadCatalog(): void {
    this.catalogContextService.getCatalog().subscribe({
      next: products => {
        this.catalog = products;
      },
      error: error => {
        console.error('Error cargando catalogo para la IA:', error);
      }
    });
  }

  get usuario() {
    return {
      correo: sessionStorage.getItem('correo') || 'demo@gmcomponents.cl',
      nombre: sessionStorage.getItem('nombre') || 'Usuario Demo',
      rol: 'cliente' as const
    };
  }

  get activeRecommendationProduct(): ProductLite | null {
    return this.recommendationSuggestions[this.activeRecommendationIndex] || null;
  }

  get activeRecommendationCopy() {
    const product = this.activeRecommendationProduct;
    if (!product) {
      return null;
    }

    return {
      title: product.rankLabel || `Recomendacion ${this.activeRecommendationIndex + 1}`,
      subtitle:
        this.recommendationRankDescriptions[this.activeRecommendationIndex] ||
        'Esta es una recomendacion valida segun tu consulta.',
      body:
        product.recommendationNote ||
        'Te la muestro como una opcion valida segun el presupuesto, el uso y la prioridad que indicaste.'
    };
  }

  get formattedRecommendationBudget(): string {
    const resolvedBudget = this.recommendationState.budget || this.parseBudgetValue(this.recommendationBudget);
    return resolvedBudget ? `$${resolvedBudget.toLocaleString('es-CL')}` : 'Presupuesto obligatorio';
  }

  get recommendationSummaryChips(): string[] {
    const chips: string[] = [this.formattedRecommendationBudget];

    if (this.recommendationState.category) {
      chips.push(this.recommendationState.category);
    }

    if (this.recommendationState.preferredBrand && !this.recommendationState.anyBrand) {
      chips.push(this.recommendationState.preferredBrand);
    }

    if (this.recommendationState.anyBrand) {
      chips.push('Marcas generales');
    }

    if (this.recommendationState.useCase) {
      chips.push(this.capitalizeRecommendationValue(this.recommendationState.useCase));
    }

    if (this.recommendationState.priority) {
      chips.push(this.capitalizeRecommendationValue(this.recommendationState.priority));
    }

    return chips;
  }

  submitFaq(): void {
    if (this.faqForm.invalid) {
      this.faqForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.faqResult = null;

    this.faqService.askFaq({
      mode: 'faq',
      usuario: this.usuario,
      pregunta: this.faqForm.value.pregunta,
      productos: this.catalog
    }).subscribe({
      next: response => {
        this.faqResult = response;
        this.loading = false;
      },
      error: error => {
        console.error(error);
        this.loading = false;
        alert('No fue posible responder la consulta.');
      }
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

    const resolvedBudget = this.recommendationState.budget || this.parseBudgetValue(this.recommendationBudget);
    if (this.recommendationStep === 'initial' && (!resolvedBudget || resolvedBudget <= 0)) {
      this.recommendationBudgetError = 'Debes ingresar tu presupuesto en CLP para continuar.';
      this.appendAssistantMessageIfNeeded(
        'Necesito tu presupuesto en CLP para continuar con la recomendacion.'
      );
      return;
    }

    this.recommendationBudgetError = '';
    this.recommendationLoading = true;
    this.recommendationMessages = [...this.recommendationMessages, { role: 'user', text }];

    this.recommendationService.chatRecommendation({
      message: text,
      budget: resolvedBudget,
      step: this.recommendationStep,
      state: this.recommendationStep === 'initial' ? undefined : this.recommendationState,
      productos: this.catalog
    }).subscribe({
      next: (response: RecommendationResponse) => {
        this.recommendationMessages = [
          ...this.recommendationMessages,
          { role: 'assistant', text: response.answer || 'No pude responder en este intento.' }
        ];
        this.recommendationState = response.state || { baseRequest: text, budget: resolvedBudget };
        this.recommendationStep = response.nextStep || 'done';
        this.recommendationQuickOptions = response.quickOptions || [];
        this.recommendationSuggestions = response.mode === 'result' ? response.suggestions || [] : [];
        this.activeRecommendationIndex = 0;
        this.recommendationMessage = '';
        this.recommendationLoading = false;
      },
      error: error => {
        console.error(error);
        this.recommendationLoading = false;
        this.appendAssistantMessageIfNeeded(
          'No fue posible generar la recomendacion en este momento. Intenta nuevamente.'
        );
      }
    });
  }

  selectRecommendationOption(option: string): void {
    this.recommendationMessage = option;
    this.submitRecommendation();
  }

  resetRecommendationConversation(): void {
    this.recommendationMessages = [{ role: 'assistant', text: this.initialAssistantMessage }];
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

    this.activeRecommendationIndex =
      this.activeRecommendationIndex === 0
        ? this.recommendationSuggestions.length - 1
        : this.activeRecommendationIndex - 1;
  }

  goToNextRecommendation(): void {
    if (this.recommendationSuggestions.length <= 1) {
      return;
    }

    this.activeRecommendationIndex =
      this.activeRecommendationIndex === this.recommendationSuggestions.length - 1
        ? 0
        : this.activeRecommendationIndex + 1;
  }

  setActiveRecommendation(index: number): void {
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
    }
  }

  private parseBudgetValue(value: string): number | undefined {
    const digits = String(value || '').replace(/\D/g, '');
    return digits ? Number.parseInt(digits, 10) : undefined;
  }

  private appendAssistantMessageIfNeeded(text: string): void {
    const last = this.recommendationMessages[this.recommendationMessages.length - 1];
    if (last && last.role === 'assistant' && last.text === text) {
      return;
    }

    this.recommendationMessages = [...this.recommendationMessages, { role: 'assistant', text }];
  }

  private capitalizeRecommendationValue(value: string): string {
    if (!value) {
      return '';
    }

    return value.charAt(0).toUpperCase() + value.slice(1);
  }
}
