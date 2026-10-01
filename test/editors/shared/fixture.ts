// Only fixture setup/assertions can access editor instances; the userscript
// consumes document events and has no access to these module-local models.
export const fixtures: Record<string, any> = {};
export const container = (name: string) => document.querySelector<HTMLElement>('#' + name)!;
export function expose(): void { Object.assign(window, { fixture: fixtures, fixtureReady: true }); }
