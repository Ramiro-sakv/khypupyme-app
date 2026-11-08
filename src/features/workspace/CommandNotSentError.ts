import { AppError } from "../../../shared/app-errors";
/** Rechazo de preparación: ningún comando financiero salió de este dispositivo. */
export class CommandNotSentError extends AppError {
  constructor(message: string) { super(message, Number(/\[(\d{3})[^\]]*\]\s*$/.exec(message)?.[1] ?? 400), "COMMAND_NOT_SENT"); }
}
