// 国际象棋名局棋谱数据：经典对局 SAN 序列（经 chess.js 逐着验证）。
// 数据源：各经典对局公开棋谱；验证脚本 _verify_chess_pgn.ts。

import type { ChessFamousGame } from './chessFamousGame';

export type { ChessFamousGame } from './chessFamousGame';

export const CHESS_FAMOUS_GAMES: ChessFamousGame[] = [
  {
    id: 'opera-1858',
    title: 'The Opera Game',
    source: 'Paul Morphy vs Duke Karl & Count Isouard, Paris Opera 1858',
    desc: 'Morphy sacrifices both rooks and the queen in a cascade of forced moves, finishing with a checkmate delivered by the last remaining piece — the immortal opera house game.',
    result: '1-0',
    moves: 'e4 e5 Nf3 d6 d4 Bg4 dxe5 Bxf3 Qxf3 dxe5 Bc4 Nf6 Qb3 Qe7 Nc3 c6 Bg5 b5 Nxb5 cxb5 Bxb5+ Nbd7 O-O-O Rd8 Rxd7 Rxd7 Rd1 Qe6 Bxd7+ Nxd7 Qb8+ Nxb8 Rd8#'.split(' ')
  },
  {
    id: 'immortal-1851',
    title: 'The Immortal Game',
    source: 'Adolf Anderssen vs Lionel Kieseritzky, London 1851',
    desc: 'Anderssen gives up both rooks, a bishop and the queen, then checkmates with his last minor pieces — the most celebrated sacrificial game ever played.',
    result: '1-0',
    moves: 'e4 e5 f4 exf4 Bc4 Qh4+ Kf1 b5 Bxb5 Nf6 Nf3 Qh6 d3 Nh5 Nh4 Qg5 Nf5 c6 g4 Nf6 Rg1 cxb5 h4 Qg6 h5 Qg5 Qf3 Ng8 Bxf4 Qf6 Nc3 Bc5 Nd5 Qxb2 Bd6 Bxg1 e5 Qxa1+ Ke2 Na6 Nxg7+ Kd8 Qf6+ Nxf6 Be7#'.split(' ')
  },
  {
    id: 'evergreen-1852',
    title: 'The Evergreen Game',
    source: 'Adolf Anderssen vs Jean Dufresne, Berlin 1852',
    desc: 'An Evans Gambit masterpiece: Anderssen sacrifices the queen and a rook to weave a mating net — Steinitz called it "the laurel of ever-green fame".',
    result: '1-0',
    moves: 'e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bxb4 c3 Ba5 d4 exd4 O-O d3 Qb3 Qf6 e5 Qg6 Re1 Nge7 Ba3 b5 Qxb5 Rb8 Qa4 Bb6 Nbd2 Bb7 Ne4 Qf5 Bxd3 Qh5 Nf6+ gxf6 exf6 Rg8 Rad1 Qxf3 Rxe7+ Nxe7 Qxd7+ Kxd7 Bf5+ Ke8 Bd7+ Kf8 Bxe7#'.split(' ')
  },
  {
    id: 'century-1956',
    title: 'The Game of the Century',
    source: 'Donald Byrne vs Bobby Fischer, New York 1956',
    desc: 'Thirteen-year-old Fischer sacrifices his queen to trap Byrne\u2019s whole army — the most famous American game of the 20th century.',
    result: '0-1',
    moves: 'Nf3 Nf6 c4 g6 Nc3 Bg7 d4 O-O Bf4 d5 Qb3 dxc4 Qxc4 c6 e4 Nbd7 Rd1 Nb6 Qc5 Bg4 Bg5 Na4 Qa3 Nxc3 bxc3 Nxe4 Bxe7 Qb6 Bc4 Nxc3 Bc5 Rfe8+ Kf1 Be6 Bxb6 Bxc4+ Kg1 Ne2+ Kf1 Nxd4+ Kg1 Ne2+ Kf1 Nc3+ Kg1 axb6 Qb4 Ra4 Qxb6 Nxd1 h3 Rxa2 Kh2 Nxf2 Re1 Rxe1 Qd8+ Bf8 Nxe1 Bd5 Nf3 Ne4 Qb8 b5 h4 h5 Ne5 Kg7 Kg1 Bc5+ Kf1 Ng3+ Ke1 Bb4+ Kd1 Bb3+ Kc1 Ne2+ Kb1 Nc3+ Kc1 Rc2#'.split(' ')
  },
  {
    id: 'kasparov-immortal-1999',
    title: 'Kasparov\u2019s Immortal',
    source: 'Garry Kasparov vs Veselin Topalov, Wijk aan Zee 1999',
    desc: 'Kasparov sacrifices his rook on e7 in one of the most brilliant attacking games ever played, mating in his 44th move — a game many call the greatest of all time.',
    result: '1-0',
    moves: 'e4 d6 d4 Nf6 Nc3 g6 Be3 Bg7 Qd2 c6 f3 b5 Nge2 Nbd7 Bh6 Bxh6 Qxh6 Bb7 a3 e5 O-O-O Qe7 Kb1 a6 Nc1 O-O-O Nb3 exd4 Rxd4 c5 Rd1 Nb6 g3 Kb8 Na5 Ba8 Bh3 d5 Qf4+ Ka7 Rhe1 d4 Nd5 Nbxd5 exd5 Qd6 Rxd4 cxd4 Re7+ Kb6 Qxd4+ Kxa5 b4+ Ka4 Qc3 Qxd5 Ra7 Bb7 Rxb7 Qc4 Qxf6 Kxa3 Qxa6+ Kxb4 c3+ Kxc3 Qa1+ Kd2 Qb2+ Kd1 Bf1 Rd2 Rd7 Rxd7 Bxc4 bxc4 Qxh8 Rd3 Qa8 c3 Qa4+ Ke1 f4 f5 Kc1 Rd2 Qa7'.split(' ')
  },
  {
    id: 'fischer-spassky-1972-g6',
    title: 'Fischer vs Spassky, 1972 Game 6',
    source: 'Bobby Fischer vs Boris Spassky, World Championship, Reykjavik 1972',
    desc: 'Fischer plays a brilliant queen sacrifice on h3 in the most famous game of the Match of the Century, winning with perfect precision against the World Champion.',
    result: '1-0',
    moves: 'c4 e6 Nf3 d5 d4 Nf6 Nc3 Be7 Bg5 O-O e3 h6 Bh4 b6 cxd5 Nxd5 Bxe7 Qxe7 Nxd5 exd5 Rc1 Be6 Qa4 c5 Qa3 Rc8 Bb5 a6 dxc5 bxc5 O-O Ra7 Be2 Nd7 Nd4 Qf8 Nxe6 fxe6 e4 d4 f4 Qe7 e5 Rb8 Bc4 Kh8 Qh3 Nf8 b3 a5 f5 exf5 Rxf5 Nh7 Rcf1 Qd8 Qg3 Re7 h4 Rbb7 e6 Rbc7 Qe5 Qe8 a4 Qd8 R1f2 Qe8 R2f3 Qd8 Bd3 Qe8 Qe4 Nf6 Rxf6 gxf6 Rxf6 Kg8 Bc4 Kh8 Qf4'.split(' ')
  },
  {
    id: 'deepblue-kasparov-1997-g6',
    title: 'Deep Blue vs Kasparov, 1997 Game 6',
    source: 'Deep Blue vs Garry Kasparov, Man vs Machine, New York 1997',
    desc: 'The computer wins the deciding sixth game of the rematch — the first time a machine beat the reigning World Champion in a match. Kasparov resigned after 19 moves.',
    result: '1-0',
    moves: 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Nd7 Ng5 Ngf6 Bd3 e6 N1f3 h6 Nxe6 Qe7 O-O fxe6 Bg6+ Kd8 Bf4 b5 a4 Bb7 Re1 Nd5 Bg3 Kc8 axb5 cxb5 Qd3 Bc6 Bf5 exf5 Rxe7 Bxe7 c4'.split(' ')
  },
  {
    id: 'capablanca-tartakower-1924',
    title: 'Capablanca vs Tartakower, 1924',
    source: 'Jose Raul Capablanca vs Savielly Tartakower, New York 1924',
    desc: '\u201CRook before you leap\u201D: Capablanca sacrifices a rook with 36.Rh7 in a classic endgame display, hunting the black king to deliver mate on the seventh rank.',
    result: '1-0',
    moves: 'd4 e6 Nf3 f5 c4 Nf6 Bg5 Be7 Nc3 O-O e3 b6 Bd3 Bb7 O-O Qe8 Qe2 Ne4 Bxe7 Nxc3 bxc3 Qxe7 a4 Bxf3 Qxf3 Nc6 Rfb1 Rae8 Qh3 Rf6 f4 Na5 Qf3 d6 Re1 Qd7 e4 fxe4 Qxe4 g6 g3 Kf8 Kg2 Rf7 h4 d5 cxd5 exd5 Qxe8+ Qxe8 Rxe8+ Kxe8 h5 Rf6 hxg6 hxg6 Rh1 Kf8 Rh7 Rc6 g4 Nc4 g5 Ne3+ Kf3 Nf5 Bxf5 gxf5 Kg3 Rxc3+ Kh4 Rf3 g6 Rxf4+ Kg5 Re4 Kf6 Kg8 Rg7+ Kh8 Rxc7 Re8 Kxf5 Re4 Kf6 Rf4+ Ke5 Rg4 g7+ Kg8 Rxa7 Rg1 Kxd5 Rc1 Kd6 Rc2 d5 Rc1 Rc7 Ra1 Kc6 Rxa4 d6'.split(' ')
  }
];
