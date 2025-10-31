# TaskManager

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 18.2.21.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Lightweight Validation Workflow

- Run `npm run validate` after each edit cycle. It decides whether lint/type-check/build steps are needed.
- Normal edits trigger `npm run lint` (excluding `functions/`, `src/app/src/`, `*.spec.ts`) and `npm run type-check` (backed by `tsconfig.typecheck.json`).
- Pure UI tweaks (HTML/CSS) and changes limited to excluded paths skip validation for faster feedback.
- A full `ng build` runs automatically every five successful edit cycles, immediately after config file changes, or right after a failed run is resolved.
- Major or risky changes should still be verified with `npm run build` and `npm run test` manually.
- Workflow state is cached in `.workflow/state.json`; delete that file to reset counters if needed.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
