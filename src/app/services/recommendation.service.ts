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

  constructor(private http: HttpClient) {}

  chatRecommendation(payload: RecommendationRequest): Observable<RecommendationResponse> {
    return this.http.post<RecommendationResponse>(this.apiUrl, payload);
  }
}
