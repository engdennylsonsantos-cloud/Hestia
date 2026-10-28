import type { Id } from '@hestia/model';
import type { DimContext, DimProvider, ElementKind, TempDim } from './types.ts';
import { openingDimProvider } from './providers/opening.ts';

// O sujeito varia por provedor; o registro guarda o contrato sem o parâmetro e só `selectionDims` o usa.
type AnyProvider = DimProvider<never>;

const providers = new Map<ElementKind, AnyProvider>();
let builtinsDone = false;

/** Liga o provedor ao tipo de elemento: ao selecionar um elemento desse tipo, as cotas dele aparecem. */
export function registerDimProvider<S>(kind: ElementKind, provider: DimProvider<S>): void {
  providers.set(kind, provider as unknown as AnyProvider);
}

export function getDimProvider(kind: ElementKind): AnyProvider | undefined {
  return providers.get(kind);
}

/** Desfaz todos os registros (testes). */
export function clearDimProviders(): void {
  providers.clear();
  builtinsDone = false;
}

/**
 * Cotas do elemento selecionado: só com UM elemento selecionado, com provedor registrado e `showOnSelection` ligado.
 */
export function selectionDims(ctx: DimContext, ids: readonly Id[]): TempDim[] {
  if (ids.length !== 1 || !ctx.settings.showOnSelection) return [];
  const el = ctx.project.elements[ids[0]!];
  const provider = el ? (providers.get(el.kind) as DimProvider<unknown> | undefined) : undefined;
  if (!el || !provider?.selectionSubject) return [];
  const subject = provider.selectionSubject(ctx.project, el.id);
  return subject === null ? [] : provider.compute(ctx, subject);
}


/** Registra os provedores que acompanham o Hestia. Idempotente; chamada na inicialização do editor. */
export function registerBuiltinDimProviders(): void {
  if (builtinsDone) return;
  builtinsDone = true;
  registerDimProvider('door', openingDimProvider);
  registerDimProvider('window', openingDimProvider);
}
