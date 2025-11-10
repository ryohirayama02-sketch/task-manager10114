/// <reference types="jasmine" />

import { Provider } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { BehaviorSubject, of } from 'rxjs';

/**
 * テスト用のモックプロバイダーを提供するユーティリティ
 * 既存のテストファイルを壊さないように、新しいファイルとして作成
 */

/**
 * Firestoreのモック
 */
export function provideMockFirestore(): Provider[] {
  const mockFirestore = {
    collection: jasmine.createSpy('collection').and.returnValue({
      doc: jasmine.createSpy('doc').and.returnValue({
        get: jasmine.createSpy('get').and.returnValue(Promise.resolve({ exists: false })),
        set: jasmine.createSpy('set').and.returnValue(Promise.resolve()),
        update: jasmine.createSpy('update').and.returnValue(Promise.resolve()),
        delete: jasmine.createSpy('delete').and.returnValue(Promise.resolve()),
      }),
      add: jasmine.createSpy('add').and.returnValue(Promise.resolve({ id: 'mock-id' })),
      get: jasmine.createSpy('get').and.returnValue(Promise.resolve({ empty: true, docs: [] })),
    }),
    doc: jasmine.createSpy('doc').and.returnValue({
      get: jasmine.createSpy('get').and.returnValue(Promise.resolve({ exists: false })),
      set: jasmine.createSpy('set').and.returnValue(Promise.resolve()),
      update: jasmine.createSpy('update').and.returnValue(Promise.resolve()),
      delete: jasmine.createSpy('delete').and.returnValue(Promise.resolve()),
    }),
  } as unknown as Firestore;

  return [{ provide: Firestore, useValue: mockFirestore }];
}

/**
 * ActivatedRouteのモック
 */
export function provideMockActivatedRoute(params: any = {}, queryParams: any = {}): Provider[] {
  const mockActivatedRoute = {
    snapshot: {
      params: params,
      queryParams: queryParams,
      paramMap: {
        get: (key: string) => params[key] || null,
        has: (key: string) => key in params,
        keys: Object.keys(params),
      },
      queryParamMap: {
        get: (key: string) => queryParams[key] || null,
        has: (key: string) => key in queryParams,
        keys: Object.keys(queryParams),
      },
    },
    params: of(params),
    queryParams: of(queryParams),
    paramMap: of({
      get: (key: string) => params[key] || null,
      has: (key: string) => key in params,
      keys: Object.keys(params),
    }),
    queryParamMap: of({
      get: (key: string) => queryParams[key] || null,
      has: (key: string) => key in queryParams,
      keys: Object.keys(queryParams),
    }),
  } as unknown as ActivatedRoute;

  return [{ provide: ActivatedRoute, useValue: mockActivatedRoute }];
}

/**
 * Routerのモック
 */
export function provideMockRouter(): Provider[] {
  const mockRouter = {
    navigate: jasmine.createSpy('navigate').and.returnValue(Promise.resolve(true)),
    navigateByUrl: jasmine.createSpy('navigateByUrl').and.returnValue(Promise.resolve(true)),
    url: '/test',
    events: of(),
    routerState: {
      root: {} as any,
    },
  } as unknown as Router;

  return [{ provide: Router, useValue: mockRouter }];
}

/**
 * MatDialogRefのモック
 */
export function provideMockMatDialogRef<T = any>(closeValue?: T): Provider[] {
  const mockDialogRef = {
    close: jasmine.createSpy('close').and.returnValue(closeValue),
    afterClosed: jasmine.createSpy('afterClosed').and.returnValue(of(closeValue)),
    componentInstance: {},
  } as unknown as MatDialogRef<T>;

  return [{ provide: MatDialogRef, useValue: mockDialogRef }];
}

/**
 * MAT_DIALOG_DATAのモック
 */
export function provideMockMatDialogData<T = any>(data: T): Provider[] {
  return [{ provide: MAT_DIALOG_DATA, useValue: data }];
}

/**
 * よく使われるモックプロバイダーの組み合わせ
 */
export const COMMON_MOCK_PROVIDERS = {
  /**
   * Firestoreのみ
   */
  firestore: provideMockFirestore(),

  /**
   * Routerのみ
   */
  router: provideMockRouter(),

  /**
   * ActivatedRouteのみ（デフォルト値）
   */
  activatedRoute: provideMockActivatedRoute(),

  /**
   * Firestore + Router
   */
  firestoreAndRouter: [
    ...provideMockFirestore(),
    ...provideMockRouter(),
  ],

  /**
   * Firestore + Router + ActivatedRoute
   */
  firestoreRouterAndRoute: [
    ...provideMockFirestore(),
    ...provideMockRouter(),
    ...provideMockActivatedRoute(),
  ],
};

