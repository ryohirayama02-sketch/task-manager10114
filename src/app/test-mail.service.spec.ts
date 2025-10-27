import { TestBed } from '@angular/core/testing';

import { TestMailService } from './test-mail.service';

describe('TestMailService', () => {
  let service: TestMailService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TestMailService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
