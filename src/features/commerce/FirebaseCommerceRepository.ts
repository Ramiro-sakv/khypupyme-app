import { httpsCallable } from 'firebase/functions';
import type { Functions } from 'firebase/functions';
import type { CommerceRepository } from './CommerceRepository';
import type { Command, DateFilter, QueryInput, RecordPage, Report } from '../../../shared/commerce';

export class FirebaseCommerceRepository implements CommerceRepository {
  constructor(private readonly functions: Functions) {}
  async execute(command: Command) {
    return (
      await httpsCallable<Command, { id: string }>(this.functions, 'commerceCommand')(command)
    ).data;
  }
  async status(operationId: string) {
    return (
      await httpsCallable<{ operationId: string }, { id: string } | null>(
        this.functions,
        'commerceQuery',
      )({ operationId })
    ).data;
  }
  async list(input: QueryInput) {
    return (await httpsCallable<QueryInput, RecordPage>(this.functions, 'commerceQuery')(input))
      .data;
  }
  async report(filter: DateFilter) {
    return (await httpsCallable<DateFilter, Report>(this.functions, 'commerceReport')(filter)).data;
  }
}
