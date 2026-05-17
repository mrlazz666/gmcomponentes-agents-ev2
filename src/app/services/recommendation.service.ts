import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { RecommendationRequest, RecommendationResponse } from '../models/recommendation.models';

@Injectable({
  providedIn: 'root'
})
export class RecommendationService {
  private readonly apiUrl = `${environment.aiProxyUrl}/api/recommendation`;
  private readonly frontendLogUrl = `${environment.aiProxyUrl}/api/recommendation/frontend-log`;

  constructor(private http: HttpClient) {}

  chatRecommendation(payload: RecommendationRequest): Observable<RecommendationResponse> {
    return this.http.post<RecommendationResponse>(this.apiUrl, payload);
  }

  logFrontendEvent(payload: {
    event: string;
    sessionId: string;
    payload?: Record<string, unknown>;
  }): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(this.frontendLogUrl, payload);
  }
}
