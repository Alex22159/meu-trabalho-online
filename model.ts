export type Kind = 'normal' | 'vip';
export type Person = { id: string; name: string; color: string; normal: number; vip: number };
export type Entry = { id: string; person: string; date: string; kind: Kind; shift: string; amount: number; received: number; note: string };
export type Settings = { title: string; normalLabel: string; vipLabel: string; normalRate: number; vipRate: number };
export type WorkData = { people: Person[]; entries: Entry[]; settings: Settings; applied: string[] };
export type Snapshot = { revision: number; data: WorkData };
export type Command = { id: string; action: 'person.save' | 'person.delete' | 'entry.save' | 'entry.delete' | 'entry.receive' | 'entries.clear' | 'settings.save'; value: unknown };
export class ValidationError extends Error {}
export const emptyData = (): WorkData => ({ people: [], entries: [], applied: [], settings: { title: 'Meu Trabalho', normalLabel: 'Normal', vipLabel: 'VIP', normalRate: 38000, vipRate: 65000 } });
function check(condition: unknown, message: string): asserts condition { if (!condition) throw new ValidationError(message); }
function record(value: unknown): Record<string, unknown> { check(value !== null && typeof value === 'object' && !Array.isArray(value), 'Dados inválidos.'); return value as Record<string, unknown>; }
function text(v: unknown, name: string, max = 100, allowEmpty = false) { check(typeof v === 'string', `${name} inválido.`); const value = v.trim(); check((allowEmpty || value.length > 0) && value.length <= max, `Confira ${name.toLowerCase()}.`); return value; }
function identifier(v: unknown) { const id = text(v, 'Identificador', 80); check(/^[a-zA-Z0-9_-]+$/.test(id), 'Identificador inválido.'); return id; }
function cents(v: unknown, name: string, zero = false) { check(typeof v === 'number' && Number.isSafeInteger(v) && v >= (zero ? 0 : 1) && v <= 100000000, `${name} inválido. Use um valor de até R$ 1.000.000.`); return v; }
export function validDate(v: unknown): v is string { if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false; const date = new Date(v + 'T12:00:00Z'); return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === v && v >= '1900-01-01' && v <= '2200-12-31'; }
export function parseCommand(raw: unknown): Command { const c = record(raw); const id = identifier(c.id); check(['person.save','person.delete','entry.save','entry.delete','entry.receive','entries.clear','settings.save'].includes(String(c.action)), 'Ação inválida.'); return { id, action: c.action as Command['action'], value: c.value }; }
export function applyCommand(source: WorkData, command: Command): WorkData {
  if (source.applied.includes(command.id)) return source;
  const data = structuredClone(source), value = record(command.value);
  switch (command.action) {
    case 'person.save': {
      const p: Person = { id: identifier(value.id), name: text(value.name, 'Nome', 60), color: text(value.color, 'Cor', 7), normal: cents(value.normal, 'Diária normal'), vip: cents(value.vip, 'Diária VIP') };
      check(/^#[0-9a-fA-F]{6}$/.test(p.color), 'Cor inválida.');
      check(!data.people.some(other => other.id !== p.id && other.name.toLocaleLowerCase('pt-BR') === p.name.toLocaleLowerCase('pt-BR')), 'Este nome já está cadastrado.');
      const index = data.people.findIndex(other => other.id === p.id);
      if (index >= 0) data.people[index] = p; else { check(data.people.length < 500, 'Limite de 500 contratantes atingido.'); data.people.push(p); } break;
    }
    case 'person.delete': { const id = identifier(value.id); check(!data.entries.some(e => e.person === id), 'Este nome tem dias registrados. Limpe ou exclua os lançamentos antes de excluir o nome.'); data.people = data.people.filter(p => p.id !== id); break; }
    case 'entry.save': {
      check(value.kind === 'normal' || value.kind === 'vip', 'Categoria inválida.'); check(validDate(value.date), 'Data inválida.');
      const e: Entry = { id: identifier(value.id), person: identifier(value.person), date: value.date, kind: value.kind, shift: text(value.shift, 'Turno', 60), amount: cents(value.amount, 'Valor da diária'), received: cents(value.received, 'Valor recebido', true), note: text(value.note, 'Observação', 300, true) };
      check(data.people.some(p => p.id === e.person), 'O contratante foi removido. Atualize e escolha outro nome.'); check(e.received <= e.amount, 'O recebido não pode ser maior que o valor da diária.');
      check(!data.entries.some(other => other.id !== e.id && other.person === e.person && other.date === e.date && other.kind === e.kind && other.shift.toLocaleLowerCase('pt-BR') === e.shift.toLocaleLowerCase('pt-BR')), 'Este dia, turno e categoria já estão marcados para este nome. Edite o registro existente.');
      const index = data.entries.findIndex(other => other.id === e.id);
      if ('before' in value) check(JSON.stringify(index >= 0 ? data.entries[index] : null) === JSON.stringify(value.before), 'Este lançamento mudou em outro aparelho. Feche a edição, atualize e abra novamente para conferir os valores.');
      if (index >= 0) data.entries[index] = e; else { check(data.entries.length < 30000, 'Limite de registros atingido. Exporte um backup antes de limpar.'); data.entries.push(e); } break;
    }
    case 'entry.receive': { const id = identifier(value.id), entry = data.entries.find(e => e.id === id); check(entry, 'Este lançamento foi removido.'); const amount = cents(value.amount, 'Recebimento'); check(entry.received + amount <= entry.amount, 'O recebimento excede o saldo atual. Confira se outro aparelho já registrou esse pagamento.'); entry.received += amount; break; }
    case 'entry.delete': data.entries = data.entries.filter(e => e.id !== identifier(value.id)); break;
    case 'entries.clear': check(typeof value.confirmation === 'string' && value.confirmation.trim().toUpperCase() === 'LIMPAR', 'Digite limpar para confirmar.'); data.entries = []; break;
    case 'settings.save': data.settings = { title: text(value.title, 'Nome do app', 45), normalLabel: text(value.normalLabel, 'Categoria normal', 24), vipLabel: text(value.vipLabel, 'Categoria VIP', 24), normalRate: cents(value.normalRate, 'Diária normal'), vipRate: cents(value.vipRate, 'Diária VIP') }; break;
  }
  data.applied = [...data.applied, command.id].slice(-100); return data;
}
export function annualSummary(data: WorkData, year: string, person?: string) {
  const entries = data.entries.filter(e => e.date.startsWith(year + '-') && (!person || e.person === person));
  const amount = entries.reduce((a,e) => a + e.amount, 0), received = entries.reduce((a,e) => a + e.received, 0);
  return { amount, received, pending: amount - received, days: new Set(entries.map(e => e.date)).size, count: entries.length };
}
