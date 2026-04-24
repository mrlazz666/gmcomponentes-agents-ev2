import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { IaHubPage } from './ia-hub.page';

const routes: Routes = [
  {
    path: '',
    component: IaHubPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class IaHubPageRoutingModule {}