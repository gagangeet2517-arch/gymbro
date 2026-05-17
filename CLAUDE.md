# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npx expo start          # start dev server (opens iOS/Android/web)
npx expo start --ios    # open in iOS simulator
npx expo start --android
npx expo start --web
expo lint               # ESLint
npx tsc --noEmit        # type-check
```

There are no automated tests in this project.

## Architecture

**gymbro** is a React Native workout tracker built with Expo Router (file-based routing) and React 19. All data is local — no backend, no auth.

### Routing

`app/_layout.tsx` is the root; it wraps the entire tree in the three context providers (order matters: `ExerciseProvider` → `TemplateProvider` → `WorkoutProvider`). `app/(tabs)/` holds the four bottom-tab screens (Home, Workouts, History, Progress). Modal/detail screens live at `app/workout/[id].tsx`, `app/history/[id].tsx`, `app/exercises/`, and `app/templates/`.

### State / Data layer

All state lives in React Context + `AsyncStorage`. Three contexts, each with a `hasHydrated` guard that prevents persisting before the initial load:

| Context | Storage key | What it holds |
|---|---|---|
| `ExerciseContext` | `gymbro_custom_exercises` | Built-in + user-created exercises; transient `selectedTemplateExercises` used during template editing |
| `TemplateContext` | `gymbro_templates` | Workout templates; seeds starter templates from `data/exerciseCatalog.ts` on first load |
| `WorkoutContext` | `gymbro_workouts` | Active workout session + completed workout history; prefills sets from the last run of the same template |

`data/exerciseCatalog.ts` is the static source of built-in exercises and the starter templates. IDs are stable strings (e.g. `'bench-press'`) used for lookup across workout history.

### UI conventions

- Dark-only theme; inline `StyleSheet.create` per file — no theming system.
- `SafeAreaView` must be imported from `react-native-safe-area-context`, not `react-native`.
- Shared primitives: `components/ui/AppButton.tsx` (primary/secondary variants) and `components/ui/AppCard.tsx`.
- Icons via `@expo/vector-icons` (Ionicons).
