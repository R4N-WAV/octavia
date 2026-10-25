export type InstrumentId = "clarinetSus" | "clarinetStac" | "harp" | "celloSection" | "violinSection";
export type PlayerActionKind = "jump" | "land" | "run";

export interface NoteRequest {
  timeBeats: number;
  durationBeats: number;
  instrument: InstrumentId;
  pitch: number;
  velocity: number;
  source: "score" | "player";
  action?: PlayerActionKind;
}

export interface MusicEvent extends NoteRequest {
  id: number;
}
