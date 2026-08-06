import { useEffect, useRef, useState } from 'react';
import { ChessGame } from './game/Chess3D';
import { XqGame } from './game/Xq3D';
import { GoGame3D } from './game/Go3D';
import { FAMOUS_GAMES, type FamousGame } from './game/famousGame';
import { GO_FAMOUS_GAMES, type GoFamousGame } from './game/goFamousGames';
import { GameConfig, GameKind, HudState, Settings } from './game/types';
import { MainMenu } from './ui/MainMenu';
import { Hud } from './ui/Hud';
import { GameOverModal, ImportModal, ExportModal, SettingsModal } from './ui/Modals';

const DEFAULT_SETTINGS: Settings = { cameraSwing: true, sound: true, coords: true, legalMoves: true };
const DEFAULT_CONFIG: GameConfig = { mode: 'computer', minutes: 0, level: 2 };
const LS_SETTINGS = 'kg-settings';
const LS_CONFIG = 'kg-config';

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return { ...fallback, ...(JSON.parse(raw) as T) };
  } catch { /* corrupted storage — fall back to defaults */ }
  return fallback;
}

function save(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}

export default function App() {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<ChessGame | XqGame | GoGame3D | null>(null);
  const kindRef = useRef<GameKind>('chess');
  const settingsRef = useRef<Settings>(load(LS_SETTINGS, DEFAULT_SETTINGS));
  const [hud, setHud] = useState<HudState | null>(null);
  const [kind, setKind] = useState<GameKind>('chess');
  const [config, setConfigState] = useState<GameConfig>(load(LS_CONFIG, DEFAULT_CONFIG));
  const [settings, setSettings] = useState<Settings>(settingsRef.current);

  const setConfig = (c: GameConfig) => { setConfigState(c); save(LS_CONFIG, c); };
  const [showSettings, setShowSettings] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showExport, setShowExport] = useState(false);

  const createGame = (k: GameKind) => {
    gameRef.current?.dispose();
    const g = k === 'chess'
      ? new ChessGame(hostRef.current!, setHud)
      : k === 'xiangqi'
        ? new XqGame(hostRef.current!, setHud)
        : new GoGame3D(hostRef.current!, setHud);
    g.applySettings(settingsRef.current);
    gameRef.current = g;
    kindRef.current = k;
    // debug hook: scripted tests drive the game instance directly
    (window as unknown as Record<string, unknown>).__game = g;
  };

  useEffect(() => {
    const autoReplay = new URLSearchParams(window.location.search).get('replay') === '1';
    if (autoReplay) {
      setKind('xiangqi');
      createGame('xiangqi');
      setTimeout(() => {
        (gameRef.current as XqGame)?.startReplay(FAMOUS_GAMES[0], `${FAMOUS_GAMES[0].source} · ${FAMOUS_GAMES[0].title}`);
      }, 1600);
    } else {
      createGame('chess');
    }
    return () => { gameRef.current?.dispose(); gameRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applySettings = (s: Settings) => {
    setSettings(s);
    settingsRef.current = s;
    save(LS_SETTINGS, s);
    gameRef.current?.applySettings(s);
  };
  const g = () => gameRef.current!;

  const onKind = (k: GameKind) => {
    setKind(k);
    if (kindRef.current !== k) createGame(k);
  };

  const startFamousReplay = (game: FamousGame | GoFamousGame, autoplay: boolean) => {
    if (kindRef.current === 'go') {
      (gameRef.current as GoGame3D).startScript(game as GoFamousGame, autoplay, `${game.source} · ${game.title}`);
      return;
    }
    if (kindRef.current !== 'xiangqi') { setKind('xiangqi'); createGame('xiangqi'); }
    (gameRef.current as XqGame).startScript(game as FamousGame, autoplay, `${game.source} · ${game.title}`);
  };

  const fullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen();
  };

  return (
    <div className="app">
      <div ref={hostRef} className="canvas-host" />
      <div className="ui">
        {hud?.screen === 'menu' && (
          <MainMenu
            config={config}
            kind={kind}
            onConfig={setConfig}
            onKind={onKind}
            onStart={() => g().startGame(config)}
            games={FAMOUS_GAMES}
            goGames={GO_FAMOUS_GAMES}
            onReplay={startFamousReplay}
            onImportScript={() => setShowImport(true)}
            onSetupStudy={() => (gameRef.current as XqGame).enterSetup()}
            onSettings={() => setShowSettings(true)}
          />
        )}
        {hud?.screen === 'game' && (
          <Hud
            hud={hud}
            settings={settings}
            onUndo={() => g().undo()}
            onResign={() => g().resign()}
            onNewGame={() => g().newGame()}
            onPass={() => (gameRef.current as GoGame3D).pass()}
            onFlip={() => g().flipCamera()}
            onFullscreen={fullscreen}
            onSettings={() => setShowSettings(true)}
            onToggleSound={() => applySettings({ ...settings, sound: !settings.sound })}
            onToggleCoords={() => applySettings({ ...settings, coords: !settings.coords })}
            onScriptToggle={() => (gameRef.current as XqGame | GoGame3D).scriptTogglePlay()}
            onScriptStep={(d) => (gameRef.current as XqGame | GoGame3D).scriptStep(d)}
            onScriptGoto={(i) => (gameRef.current as XqGame | GoGame3D).scriptGoTo(i)}
            onScriptExit={() => (gameRef.current as XqGame | GoGame3D).scriptExit()}
            onScriptBranch={(ply) => (gameRef.current as XqGame | GoGame3D).scriptSwitchBranch(ply)}
            onScriptImport={() => setShowImport(true)}
            onScriptExport={() => setShowExport(true)}
            onSetupDelete={() => (gameRef.current as XqGame).setupDeleteSelected()}
            onSetupClear={() => (gameRef.current as XqGame).setupClear()}
            onSetupReset={() => (gameRef.current as XqGame).setupReset()}
            onSetupStudy={() => (gameRef.current as XqGame).setupStudy()}
            onSetupExit={() => (gameRef.current as XqGame).setupExit()}
          />
        )}
        {/* no game-over modal in script mode — the result is announced in the replay note */}
        {hud?.screen === 'game' && hud.over && !hud.scriptInfo && (
          <GameOverModal
            over={hud.over}
            names={hud.names}
            onRematch={() => g().newGame()}
            onMenu={() => g().toMenu()}
          />
        )}
        {showSettings && (
          <SettingsModal
            settings={settings}
            onChange={applySettings}
            onClose={() => setShowSettings(false)}
          />
        )}
        {showImport && (
          <ImportModal
            onImport={(t) => (gameRef.current as XqGame).scriptImportText(t)}
            onClose={() => setShowImport(false)}
          />
        )}
        {showExport && (
          <ExportModal
            text={(gameRef.current as XqGame | GoGame3D).scriptExportText()}
            onClose={() => setShowExport(false)}
          />
        )}
      </div>
    </div>
  );
}
