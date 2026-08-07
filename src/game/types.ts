export type Side = 'w' | 'b';
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type Mode = 'computer' | 'local' | 'showcase';
export type GameKind = 'chess' | 'xiangqi' | 'go';
/** AI 难度：1=Easy，2=Medium，3=Hard。 */
export type Level = 1 | 2 | 3;

export interface GameConfig {
  mode: Mode;
  minutes: number; // 0 = no clock
  goSize?: number; // go board size: 9 / 13 / 19
  level?: Level; // AI difficulty (default 2)
}

export interface Settings {
  cameraSwing: boolean;
  sound: boolean;
  coords: boolean;
  legalMoves: boolean;
}

export interface ScriptInfo {
  title: string;
  source: string;
  desc: string;
  result: string;
  total: number; // total plies of the CURRENT PATH
  index: number; // current ply 0..total
  playing: boolean;
  over: boolean;
  notes: string[]; // traditional notation per ply (notes[i] = ply i+1 of the current path)
  branches: number[]; // children count per path node (branches[i] = path node i); >1 means a variation fork
  onMain: boolean; // current ply is on the mainline (false = standing on a variation)
  custom: boolean; // imported / board-study script (no famous-game library backing)
  /** 棋种：围棋打谱时为 'go'，国际象棋为 'chess'（象棋不设，保持向后兼容）。 */
  game?: 'go' | 'chess';
}

export interface HudState {
  screen: 'menu' | 'game';
  game: GameKind;
  mode: Mode;
  turn: Side;
  names: { w: string; b: string };
  check: boolean;
  capturedByW: string[]; // glyphs of pieces captured by side w
  capturedByB: string[];
  diff: number; // >0 side w ahead
  clockW: number | null;
  clockB: number | null;
  over: { winner: Side | null; reason: string } | null;
  canUndo: boolean;
  humanSide: Side | null;
  replayNote?: string | null;
  scriptInfo?: ScriptInfo | null;
  setup?: boolean; // board-editing (setup) mode active
}

export const SIDE_NAME: Record<Side, string> = { w: 'Ivory', b: 'Obsidian' };

export const PIECE_VALUE: Record<PieceType, number> = {
  p: 1, n: 3, b: 3, r: 5, q: 9, k: 0
};

export const PIECE_GLYPH: Record<PieceType, string> = {
  p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚'
};
