import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { FaqRequest, FaqResponse } from '../models/faq.models';

@Injectable({
  providedIn: 'root'
})
export class FaqService {
  private readonly apiUrl = `${environment.aiProxyUrl}/api/faq`;

  constructor(private http: HttpClient) {}

  askFaq(payload: FaqRequest): Observable<FaqResponse> {
    return this.http.post<FaqResponse>(this.apiUrl, payload);
  }
}
