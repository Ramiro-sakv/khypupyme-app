import type {
  Command,
  DateFilter,
  FinancialRecord,
  QueryInput,
  RecordPage,
  Report,
  Resource,
} from '../../../shared/commerce';

export interface CommerceRepository {
  execute(command: Command): Promise<{ id: string }>;
  status(operationId: string): Promise<{ id: string } | null>;
  list(input: QueryInput): Promise<RecordPage>;
  report(filter: DateFilter): Promise<Report>;
}
export class CommerceService {
  constructor(private readonly repository: CommerceRepository) {}
  execute(command: Command) {
    return this.repository.execute(command);
  }
  status(id: string) {
    return this.repository.status(id);
  }
  list(resource: Resource, filter?: DateFilter, cursor?: string): Promise<RecordPage> {
    return this.repository.list({
      resource,
      ...(filter ? { filter } : {}),
      ...(cursor ? { cursor } : {}),
    });
  }
  async get(resource: Resource, id: string): Promise<FinancialRecord | null> {
    return (await this.repository.list({ resource, id })).items[0] ?? null;
  }
  report(filter: DateFilter) {
    return this.repository.report(filter);
  }
}
