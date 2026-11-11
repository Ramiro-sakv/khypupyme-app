import { errorMessage } from "../../../shared/errors";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType } from "react";
import { useSearchParams } from "react-router";
import {
  tutorialSteps,
  TUTORIAL_VERSION,
} from "../../../../shared/workspace/timber-tutorial";
import type {
  TutorialControl,
  TutorialReply,
  TutorialState,
} from "../../../../shared/workspace/timber-tutorial";
import type { WorkspaceBusiness } from "../../../../shared/workspace/model";
import type { WorkspaceRepository } from "../WorkspaceRepository";
import { operationJournal } from "../OperationJournal";
import { draftRepository } from "../IndexedDbDraftRepository";
import { definitiveFailure } from "../WorkspaceCommandService";
import { confirmDiscardChanges } from "../navigation";
import { tutorialControlStore } from "./TutorialControlStore";
import { TutorialWorkspaceRepository } from "./TutorialWorkspaceRepository";
import { TutorialContext } from "./context";
import type { GuidePosition } from "./useMovableGuide";
interface RuntimeWorkspace {
  business: WorkspaceBusiness;
  repository: WorkspaceRepository;
  onBusiness: (b: WorkspaceBusiness) => void;
  onExit: () => void;
}
const empty: TutorialState = { session: null, business: null };
export default function TimberTutorialHost({
  uid,
  business,
  repository,
  onBusiness,
  onExit,
  component: Component,
}: {
  uid: string;
  business: WorkspaceBusiness;
  repository: WorkspaceRepository;
  onBusiness: (b: WorkspaceBusiness) => void;
  onExit: () => void;
  component: ComponentType<RuntimeWorkspace & { uid: string }>;
}) {
  const [state, setState] = useState<TutorialState>(empty),
    [active, setActive] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [pending, setPending] = useState<TutorialControl | null>(null),
    [fieldSelection, setFieldSelection] = useState({ step: "", index: 0 }),
    [, setParams] = useSearchParams(),
    alive = useRef(true),
    locked = useRef(false);
  const navigation = useRef(setParams);
  const guidePosition = useRef<GuidePosition | null>(null);
  useEffect(() => {
    navigation.current = setParams;
  }, [setParams]);
  const transport = useMemo(
      () => repository.tutorial?.bind(repository),
      [repository],
    ),
    sourceId = business.id;
  const accept = useCallback(
    async (next: TutorialState) => {
      if (
        next.session &&
        ["completed", "abandoned"].includes(next.session.status)
      ) {
        const key = "khypupyme:tutorial-clean:" + uid + ":" + next.session.id,
          id = "practice-" + next.session.id;
        if (localStorage.getItem(key) !== String(next.session.version)) {
          await draftRepository.purgeRemoved(uid, [id]);
          await operationJournal.purgeRemoved(uid, [id], []);
          const original = await tutorialControlStore.get(uid, sourceId);
          if (original?.sessionId === next.session.id) {
            await tutorialControlStore.clear(uid, sourceId, original);
            if (alive.current) setPending(null);
          }
          localStorage.setItem(key, String(next.session.version));
          if (alive.current) {
            setActive(false);
            setNotice(
              "Práctica eliminada. Los registros de tu negocio se conservaron.",
            );
            navigation.current({ vista: "inicio" });
          }
        }
      }
      if (alive.current && next.session?.status !== "active") setActive(false);
      if (alive.current)
        setState((old) => {
          if (old.session &&
          next.session?.id === old.session.id &&
          next.session.revision < old.session.revision &&
          ["active", "paused"].includes(next.session.status)) return old;
          const completedAt = next.completedAt ?? old.completedAt ??
            (old.session?.status === "completed" ? old.session.finishedAt : null);
          return completedAt ? { ...next, completedAt } : next;
        });
    },
    [uid, sourceId],
  );
  useEffect(() => {
    alive.current = true;
    let current = true;
    if (transport && business.industryId === "timber") {
      void Promise.all([
        transport({
          action: "current",
          sourceBusinessId: sourceId,
          payload: {},
        }),
        tutorialControlStore.get(uid, sourceId),
      ])
        .then(async ([reply, p]) => {
          if (current) {
            setPending(p);
            await accept(reply.state);
          }
        })
        .catch((e) => {
          if (current)
            setError(errorMessage(e, "No se pudo consultar el tutorial."));
        });
    }
    return () => {
      current = false;
      alive.current = false;
    };
  }, [uid, sourceId, business.industryId, transport, accept]);
  const practice = state.session?.practiceBusinessId,
    sessionId = state.session?.id;
  const practiceRepo = useMemo(
    () =>
      transport && practice && sessionId
        ? new TutorialWorkspaceRepository(
            transport,
            sourceId,
            sessionId,
            practice,
          )
        : null,
    [transport, sourceId, practice, sessionId],
  );
  useEffect(
    () =>
      practiceRepo?.subscribe((next) => {
        void accept(next).catch((e) => {
          if (alive.current)
            setError(errorMessage(e, "No se pudo actualizar el tutorial."));
        });
      }),
    [practiceRepo, accept],
  );
  const stepKey =
    (state.session?.id ?? "") + ":" + (state.session?.stepIndex ?? 0);
  const fieldIndex = fieldSelection.step === stepKey ? fieldSelection.index : 0;
  const setFieldIndex = (index: number) =>
    setFieldSelection({ step: stepKey, index });
  async function perform(task: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true;
    setLoading(true);
    setError("");
    try {
      await task();
    } catch (e) {
      if (alive.current)
        setError(errorMessage(e, "No se pudo completar el tutorial."));
    } finally {
      locked.current = false;
      if (alive.current) setLoading(false);
    }
  }
  async function send(request: TutorialControl) {
    if (!transport)
      throw new Error("Este entorno todavía no tiene el tutorial.");
    let reply: TutorialReply;
    try {
      reply = await transport({
        action: "control",
        sourceBusinessId: sourceId,
        payload: request,
      });
    } catch (e) {
      if (definitiveFailure(e)) {
        await tutorialControlStore.clear(uid, sourceId, request);
        if (alive.current) setPending(null);
      }
      throw e;
    }
    await accept(reply.state);
    await tutorialControlStore.clear(uid, sourceId, request);
    if (alive.current) {
      setPending(null);
      if (
        ["start", "resume"].includes(request.kind) &&
        reply.state.session?.status === "active"
      ) {
        setActive(true);
        setNotice("");
        setParams({
          vista:
            tutorialSteps(reply.state.session.version)[
              reply.state.session.stepIndex
            ]?.view ?? "inicio",
        });
      }
      if (request.kind === "pause") {
        setActive(false);
        setParams({ vista: "inicio" });
        setNotice("Práctica pausada. Se conserva el último paso confirmado.");
      }
    }
  }
  async function control(kind: TutorialControl["kind"], moduleId?: string) {
    await perform(async () => {
      if (pending)
        throw new Error(
          "Consulta o reintenta la solicitud de tutorial pendiente.",
        );
      const existing = await tutorialControlStore.get(uid, sourceId);
      if (existing) {
        setPending(existing);
        throw new Error("Otra pestaña conserva una solicitud de tutorial.");
      }
      const id = crypto.randomUUID(),
        request: TutorialControl = {
          kind,
          ...(moduleId ? { moduleId } : {}),
          operationId: id,
          sessionId: kind === "start" ? id : (state.session?.id ?? ""),
          expectedRevision: state.session?.revision ?? 0,
          stepId:
            tutorialSteps(state.session?.version ?? TUTORIAL_VERSION)[
              state.session?.stepIndex ?? 0
            ]?.id ?? "",
        };
      await tutorialControlStore.save(uid, sourceId, request);
      setPending(request);
      await send(request);
    });
  }
  const usingPractice = !!(
    active &&
    practiceRepo &&
    state.business &&
    state.session?.status === "active"
  );
  const runtime = {
    guidePosition,
    state,
    active: usingPractice,
    loading,
    error,
    notice,
    pendingControl: !!pending,
    fieldIndex,
    setFieldIndex,
    start: async () => {
      if (!confirmDiscardChanges()) return;
      if (await operationJournal.get(uid, sourceId)) {
        setError(
          "Resuelve la solicitud pendiente de tu negocio antes de practicar.",
        );
        return;
      }
      await control(
        state.session && ["active", "paused"].includes(state.session.status)
          ? "resume"
          : "start",
      );
    },
    chooseModule: async (id: string) => {
      if (confirmDiscardChanges()) await control("module", id);
    },
    pause: async () => {
      if (confirmDiscardChanges()) await control("pause");
    },
    advance: async () => {
      await control("advance");
    },
    finish: async (abandon = false) => {
      if (
        window.confirm(
          abandon
            ? "¿Abandonar y eliminar exclusivamente esta práctica?"
            : "¿Finalizar y eliminar exclusivamente los movimientos de esta práctica?",
        )
      )
        await control(abandon ? "abandon" : "finish");
    },
    consult: async () => {
      await perform(async () => {
        if (!transport) return;
        await accept(
          (
            await transport({
              action: "current",
              sourceBusinessId: sourceId,
              payload: {},
            })
          ).state,
        );
        setPending(await tutorialControlStore.get(uid, sourceId));
      });
    },
    retry: async () => {
      await perform(async () => {
        const original = await tutorialControlStore.get(uid, sourceId);
        if (!original)
          throw new Error("No hay una solicitud de tutorial pendiente.");
        await send(original);
      });
    },
    pdfDone: async () => {
      if (
        state.session &&
        tutorialSteps(state.session.version)[state.session.stepIndex]?.pdf
      )
        await control("advance");
    },
  };
  return (
    <TutorialContext value={runtime}>
      {usingPractice ? (
        <Component
          key={state.business!.id}
          uid={uid}
          business={state.business!}
          repository={practiceRepo!}
          onBusiness={(b) => setState((old) => ({ ...old, business: b }))}
          onExit={() => {
            void control("pause");
          }}
        />
      ) : (
        <Component
          key={business.id}
          uid={uid}
          business={business}
          repository={repository}
          onBusiness={onBusiness}
          onExit={onExit}
        />
      )}
    </TutorialContext>
  );
}
