import { createContext, useContext } from "react";
import type { RefObject } from "react";
import type { GuidePosition } from "./useMovableGuide";
import type { TutorialState } from "../../../../shared/workspace/timber-tutorial";
export interface TutorialRuntime {
  guidePosition: RefObject<GuidePosition | null>;
  state: TutorialState;
  active: boolean;
  loading: boolean;
  error: string;
  notice: string;
  pendingControl: boolean;
  fieldIndex: number;
  setFieldIndex: (n: number) => void;
  start: () => Promise<void>;
  chooseModule: (id: string) => Promise<void>;
  pause: () => Promise<void>;
  advance: () => Promise<void>;
  finish: (abandon?: boolean) => Promise<void>;
  consult: () => Promise<void>;
  retry: () => Promise<void>;
  pdfDone: () => Promise<void>;
}
export const TutorialContext = createContext<TutorialRuntime | null>(null);
export const useTimberTutorial = () => useContext(TutorialContext);
