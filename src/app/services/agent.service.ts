import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AgentChatRequest, AgentChatResponse } from '../models/agent.model';

@Injectable({
  providedIn: 'root'
})
export class AgentService {
  private readonly apiUrl = `${environment.aiProxyUrl}/api/agent`;

  constructor(private http: HttpClient) {}

  chatAgent(payload: AgentChatRequest): Observable<AgentChatResponse> {
    return this.http.post<AgentChatResponse>(`${this.apiUrl}/chat`, payload);
  }

  health(): Observable<{ ok: boolean; service: string; python?: string }> {
    return this.http.get<{ ok: boolean; service: string; python?: string }>(`${this.apiUrl}/health`);
  }
}
