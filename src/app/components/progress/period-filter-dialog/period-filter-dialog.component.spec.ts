import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PeriodFilterDialogComponent } from './period-filter-dialog.component';

describe('PeriodFilterDialogComponent', () => {
  let component: PeriodFilterDialogComponent;
  let fixture: ComponentFixture<PeriodFilterDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PeriodFilterDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PeriodFilterDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
