import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'ia-hub',
    pathMatch: 'full',
  },
  {
    path: 'ia-hub',
    loadChildren: () =>
      import('./ia-hub/ia-hub.module').then(m => m.IaHubPageModule),
  },
  {
    path: '**',
    redirectTo: 'ia-hub',
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
