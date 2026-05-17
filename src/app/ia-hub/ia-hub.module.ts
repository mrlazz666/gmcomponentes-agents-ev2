import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { IaHubPageRoutingModule } from './ia-hub-routing.module';
import { IaHubPage } from './ia-hub.page';


@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    IaHubPageRoutingModule
  ],
  declarations: [IaHubPage]
})
export class IaHubPageModule {}