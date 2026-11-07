import { useEffect, useMemo, useRef, useState } from "react";
import type { WorkspaceCommand } from "../../../shared/workspace/model";
import type { DraftKind, TradeDraft, TradeDraftInput } from "./DraftRepository";
import { DraftConflict } from "./DraftRepository";
import { draftRepository } from "./IndexedDbDraftRepository";
import { operationJournal } from "./OperationJournal";
import type { RestoredTrade } from "./TradeDraftService";
import { TradeDraftService } from "./TradeDraftService";
import { definitiveFailure } from "./WorkspaceCommandService";
import { useWorkspace } from "./context";
export function useTradeDraft(
  kind: DraftKind,
  input: TradeDraftInput,
  onRestore: (restored: RestoredTrade) => void,
  onConfirmed: () => void,
) {
  const {
      identity,
      repository,
      pending,
      confirmedOperationId,
      rejectedOperationId,
    } = useWorkspace(),
    session = useMemo(
      () =>
        new TradeDraftService(
          draftRepository,
          repository,
          operationJournal,
          identity,
          kind,
        ),
      [identity, repository, kind],
    ),
    [state, setState] = useState<{
      phase:
        | "loading"
        | "available"
        | "editing"
        | "saving"
        | "saved"
        | "conflict"
        | "submitted"
        | "error";
      saved: TradeDraft | null;
      error: string;
    }>({ phase: "loading", saved: null, error: "" }),
    [review, setReview] = useState<RestoredTrade | null>(null),
    [restoring, setRestoring] = useState(false),
    alive = useRef(true),
    frozen = useRef(false),
    latest = useRef(input);
  const serialized = JSON.stringify(input),
    message = (e: unknown) =>
      e instanceof Error ? e.message : "No se pudo guardar el borrador.";
  useEffect(() => {
    latest.current = input;
  }, [input]);
  useEffect(() => {
    let active = true;
    alive.current = true;
    session
      .load()
      .then((saved) => {
        if (active)
          setState({
            phase: saved?.submitted
              ? "submitted"
              : saved
                ? "available"
                : "editing",
            saved,
            error: "",
          });
      })
      .catch((e) => {
        if (active)
          setState({ phase: "error", saved: null, error: message(e) });
      });
    return () => {
      active = false;
      alive.current = false;
    };
  }, [session]);
  useEffect(() => {
    if (
      !confirmedOperationId ||
      session.current?.submitted?.operationId !== confirmedOperationId
    )
      return;
    let active = true;
    void session
      .confirmed(session.current.submitted)
      .then(() => {
        if (active) {
          frozen.current = false;
          onConfirmed();
          setState({ phase: "editing", saved: null, error: "" });
        }
      })
      .catch((e) => {
        if (active)
          setState((old) => ({
            ...old,
            phase: "submitted",
            error: "La operación está confirmada. " + message(e),
          }));
      });
    return () => {
      active = false;
    };
  }, [confirmedOperationId, session, onConfirmed]);
  useEffect(() => {
    const command = session.current?.submitted;
    if (!command || command.operationId !== rejectedOperationId) return;
    let active = true;
    void session
      .failed(command, true)
      .then((saved) => {
        frozen.current = false;
        if (active)
          setState({
            phase: saved?.submitted ? "submitted" : "available",
            saved,
            error:
              "La solicitud fue rechazada. Restaura el borrador para corregirla.",
          });
      })
      .catch((e) => {
        if (active)
          setState((old) => ({
            ...old,
            phase: "submitted",
            error: message(e),
          }));
      });
    return () => {
      active = false;
    };
  }, [rejectedOperationId, session]);
  const editable = ["editing", "saved", "saving"].includes(state.phase);
  useEffect(() => {
    if (
      !editable ||
      pending ||
      frozen.current ||
      (!input.lines.length && !session.current)
    )
      return;
    const timer = window.setTimeout(() => {
      if (frozen.current) return;
      setState((old) => ({ ...old, phase: "saving" }));
      void session
        .save(JSON.parse(serialized))
        .then((saved) => {
          if (alive.current && !frozen.current)
            setState({ phase: "saved", saved, error: "" });
        })
        .catch((e) => {
          if (alive.current)
            setState({
              phase: e instanceof DraftConflict ? "conflict" : "error",
              saved: session.current,
              error: message(e),
            });
        });
    }, 600);
    return () => window.clearTimeout(timer);
  }, [serialized, editable, pending, session, input.lines.length]);
  function accept(value: RestoredTrade) {
    session.accept(value);
    onRestore(value);
    setReview(null);
    setState({ phase: "editing", saved: value.draft, error: "" });
  }
  async function restore() {
    setRestoring(true);
    try {
      const restored = await session.inspect();
      if (
        restored.priceChanges.length ||
        restored.serialsCleared ||
        restored.requiresNewQuote
      )
        setReview(restored);
      else accept(restored);
    } catch (e) {
      setState((old) => ({ ...old, error: message(e) }));
    } finally {
      setRestoring(false);
    }
  }
  async function replace() {
    try {
      const saved = await session.replace(latest.current);
      setState({ phase: "saved", saved, error: "" });
    } catch (e) {
      setState({
        phase: e instanceof DraftConflict ? "conflict" : "error",
        saved: session.current,
        error: message(e),
      });
    }
  }
  async function discard() {
    try {
      await session.discard();
      setReview(null);
      setState({ phase: "editing", saved: null, error: "" });
    } catch (e) {
      setState((old) => ({
        ...old,
        phase: e instanceof DraftConflict ? "conflict" : old.phase,
        error: message(e),
      }));
    }
  }
  return {
    ...state,
    unsaved:
      state.phase === "saved" &&
      JSON.stringify(state.saved?.input) !== serialized,
    review,
    restoring,
    editable,
    restore,
    accept,
    replace,
    discard,
    async beforeSubmit(command: WorkspaceCommand, snapshot: TradeDraftInput) {
      if (!editable)
        throw new Error(
          "Restaura o descarta el borrador guardado antes de confirmar.",
        );
      frozen.current = true;
      try {
        const saved = await session.beforeSubmit(snapshot, command);
        if (alive.current) setState({ phase: "submitted", saved, error: "" });
      } catch (e) {
        frozen.current = false;
        if (alive.current)
          setState({
            phase: e instanceof DraftConflict ? "conflict" : "error",
            saved: session.current,
            error: message(e),
          });
        throw e;
      }
    },
    async failed(command: WorkspaceCommand, cause: unknown) {
      try {
        const saved = await session.failed(command, definitiveFailure(cause));
        if (alive.current)
          setState({
            phase: saved?.submitted ? "submitted" : "editing",
            saved,
            error: "",
          });
      } catch (e) {
        if (alive.current)
          setState((old) => ({
            ...old,
            phase: "submitted",
            error: message(e),
          }));
      } finally {
        frozen.current = false;
      }
    },
    async confirmed(command: WorkspaceCommand) {
      try {
        await session.confirmed(command);
        if (alive.current)
          setState({ phase: "editing", saved: null, error: "" });
      } catch (e) {
        if (alive.current)
          setState({
            phase: "submitted",
            saved: session.current,
            error: "La operación se confirmó. " + message(e),
          });
      } finally {
        frozen.current = false;
      }
    },
    async inspectSubmission() {
      try {
        const checked = await session.inspectSubmission();
        if (checked.result) {
          onConfirmed();
          if (alive.current)
            setState({ phase: "editing", saved: null, error: "" });
          return null;
        }
        return checked.draft.submitted;
      } catch (e) {
        if (alive.current) setState((old) => ({ ...old, error: message(e) }));
        return null;
      }
    },
  };
}
