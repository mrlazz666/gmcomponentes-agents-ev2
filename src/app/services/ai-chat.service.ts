import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { RecommendationRequest, RecommendationResponse } from '../models/recommendation.models';
import { FaqRequest, FaqResponse } from '../models/faq.models';

@Injectable({
  providedIn: 'root'
})
export class AiChatService {
  private readonly apiUrl = `${environment.aiProxyUrl}/api/ai-hub`;

  constructor(private http: HttpClient) {}

  getRecommendation(payload: RecommendationRequest): Observable<RecommendationResponse> {
    return this.http.post<RecommendationResponse>(this.apiUrl, payload);
  }

  askFaq(payload: FaqRequest): Observable<FaqResponse> {
    return this.http.post<FaqResponse>(this.apiUrl, payload);
  }
}