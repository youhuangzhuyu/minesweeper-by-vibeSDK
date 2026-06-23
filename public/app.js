import React, { useState, useEffect, useCallback, useRef } from "react";
import { createRoot } from "react-dom/client";
import { Bomb, Flag, RefreshCw, Timer, Trophy, Skull, Settings, ChevronDown, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const DIFFICULTIES = {
  BEGINNER: { rows: 9, cols: 9, mines: 10, label: "BEGINNER" },
  INTERMEDIATE: { rows: 16, cols: 16, mines: 40, label: "INTERMEDIATE" },
  EXPERT: { rows: 16, cols: 30, mines: 99, label: "EXPERT" },
};

const CELL_SIZE = 32;

const App = () => {
  const [difficulty, setDifficulty] = useState(DIFFICULTIES.BEGINNER);
  const [board, setBoard] = useState([]);
  const [gameStatus, setGameStatus] = useState("idle"); // idle, playing, won, lost
  const [flags, setFlags] = useState(0);
  const [timer, setTimer] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  
  const timerRef = useRef(null);

  // Initialize board
  const initBoard = useCallback((rows, cols) => {
    return Array(rows).fill(null).map(() => 
      Array(cols).fill(null).map(() => ({
        isMine: false,
        isRevealed: false,
        isFlagged: false,
        neighborCount: 0,
      }))
    );
  }, []);

  const resetGame = useCallback(() => {
    setBoard(initBoard(difficulty.rows, difficulty.cols));
    setGameStatus("idle");
    setFlags(0);
    setTimer(0);
    if (timerRef.current) clearInterval(timerRef.current);
  }, [difficulty, initBoard]);

  useEffect(() => {
    resetGame();
  }, [resetGame]);

  // Timer logic
  useEffect(() => {
    if (gameStatus === "playing") {
      timerRef.current = setInterval(() => {
        setTimer(t => Math.min(t + 1, 999));
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameStatus]);

  const getNeighbors = (r, c, rows, cols) => {
    const neighbors = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
          neighbors.push([nr, nc]);
        }
      }
    }
    return neighbors;
  };

  const placeMines = (initialR, initialC, currentBoard) => {
    const { rows, cols, mines } = difficulty;
    const newBoard = JSON.parse(JSON.stringify(currentBoard));
    let minesPlaced = 0;

    while (minesPlaced < mines) {
      const r = Math.floor(Math.random() * rows);
      const c = Math.floor(Math.random() * cols);

      // Don't place mine on initial click or its neighbors
      const isNearInitial = Math.abs(r - initialR) <= 1 && Math.abs(c - initialC) <= 1;
      
      if (!newBoard[r][c].isMine && !isNearInitial) {
        newBoard[r][c].isMine = true;
        minesPlaced++;
      }
    }

    // Calculate neighbor counts
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!newBoard[r][c].isMine) {
          const neighbors = getNeighbors(r, c, rows, cols);
          newBoard[r][c].neighborCount = neighbors.filter(([nr, nc]) => newBoard[nr][nc].isMine).length;
        }
      }
    }

    return newBoard;
  };

  const revealCell = (r, c, currentBoard) => {
    if (currentBoard[r][c].isRevealed || currentBoard[r][c].isFlagged) return currentBoard;

    const newBoard = [...currentBoard];
    newBoard[r][c] = { ...newBoard[r][c], isRevealed: true };

    if (newBoard[r][c].isMine) {
      setGameStatus("lost");
      // Reveal all mines
      newBoard.forEach(row => row.forEach(cell => {
        if (cell.isMine) cell.isRevealed = true;
      }));
      return newBoard;
    }

    if (newBoard[r][c].neighborCount === 0) {
      const neighbors = getNeighbors(r, c, difficulty.rows, difficulty.cols);
      neighbors.forEach(([nr, nc]) => {
        revealCell(nr, nc, newBoard);
      });
    }

    return newBoard;
  };

  const checkWin = (currentBoard) => {
    const { rows, cols, mines } = difficulty;
    let revealedCount = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (currentBoard[r][c].isRevealed) revealedCount++;
      }
    }
    if (revealedCount === rows * cols - mines) {
      setGameStatus("won");
      return true;
    }
    return false;
  };

  const handleCellClick = (r, c) => {
    if (gameStatus === "won" || gameStatus === "lost" || board[r][c].isFlagged) return;

    let newBoard = board;
    if (gameStatus === "idle") {
      newBoard = placeMines(r, c, board);
      setGameStatus("playing");
    }

    newBoard = revealCell(r, c, newBoard);
    setBoard([...newBoard]);
    checkWin(newBoard);
  };

  const handleContextMenu = (e, r, c) => {
    e.preventDefault();
    if (gameStatus !== "playing" && gameStatus !== "idle") return;
    if (board[r][c].isRevealed) return;

    const newBoard = [...board];
    const isFlagged = !newBoard[r][c].isFlagged;
    
    if (isFlagged && flags >= difficulty.mines) return;

    newBoard[r][c] = { ...newBoard[r][c], isFlagged };
    setBoard(newBoard);
    setFlags(prev => isFlagged ? prev + 1 : prev - 1);
  };

  const handleChording = (r, c) => {
    if (gameStatus !== "playing" || !board[r][c].isRevealed || board[r][c].neighborCount === 0) return;

    const neighbors = getNeighbors(r, c, difficulty.rows, difficulty.cols);
    const flaggedNeighbors = neighbors.filter(([nr, nc]) => board[nr][nc].isFlagged).length;

    if (flaggedNeighbors === board[r][c].neighborCount) {
      let newBoard = [...board];
      neighbors.forEach(([nr, nc]) => {
        if (!newBoard[nr][nc].isRevealed && !newBoard[nr][nc].isFlagged) {
          newBoard = revealCell(nr, nc, newBoard);
        }
      });
      setBoard([...newBoard]);
      checkWin(newBoard);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 select-none">
      <div className="max-w-full">
        {/* Terminal Header */}
        <div className="mb-6 w-full flex flex-col md:flex-row items-center justify-between gap-4 border border-[#1a2421] p-4 bg-[#0a0f0d]/80 backdrop-blur-sm rounded-lg shadow-[0_0_20px_rgba(0,255,65,0.05)]">
          <div className="flex items-center gap-6">
            <div className="flex flex-col">
              <span className="text-[10px] text-emerald-900 font-bold uppercase tracking-widest">Status</span>
              <div className="flex items-center gap-2">
                {gameStatus === "idle" && <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
                {gameStatus === "playing" && <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#00ff41]" />}
                {gameStatus === "won" && <Trophy className="w-4 h-4 text-emerald-400" />}
                {gameStatus === "lost" && <Skull className="w-4 h-4 text-red-500" />}
                <span className={cn(
                  "font-bold text-sm tracking-wider",
                  gameStatus === "lost" ? "text-red-500" : "text-emerald-400"
                )}>
                  {gameStatus.toUpperCase()}
                </span>
              </div>
            </div>

            <div className="flex flex-col border-l border-[#1a2421] pl-6">
              <span className="text-[10px] text-emerald-900 font-bold uppercase tracking-widest">Mines</span>
              <div className="flex items-center gap-2">
                <Bomb className="w-4 h-4 text-emerald-700" />
                <span className="font-bold text-xl tabular-nums tracking-tighter glow">
                  {String(difficulty.mines - flags).padStart(3, '0')}
                </span>
              </div>
            </div>

            <div className="flex flex-col border-l border-[#1a2421] pl-6">
              <span className="text-[10px] text-emerald-900 font-bold uppercase tracking-widest">Time</span>
              <div className="flex items-center gap-2">
                <Timer className="w-4 h-4 text-emerald-700" />
                <span className="font-bold text-xl tabular-nums tracking-tighter glow">
                  {String(timer).padStart(3, '0')}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 hover:bg-emerald-950/30 text-emerald-800 hover:text-emerald-400 transition-colors rounded border border-transparent hover:border-emerald-900/50"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button 
              onClick={resetGame}
              className="px-4 py-2 bg-emerald-950/20 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-900/50 hover:border-emerald-500 transition-all rounded font-bold flex items-center gap-2 group"
            >
              <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
              REBOOT
            </button>
          </div>
        </div>

        {/* Difficulty Dropdown */}
        <AnimatePresence>
          {showSettings && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 p-2 bg-[#0a0f0d] border border-[#1a2421] rounded-lg flex flex-wrap gap-2"
            >
              {Object.entries(DIFFICULTIES).map(([key, val]) => (
                <button
                  key={key}
                  onClick={() => {
                    setDifficulty(val);
                    setShowSettings(false);
                  }}
                  className={cn(
                    "flex-1 px-4 py-2 text-xs font-bold border transition-all rounded flex items-center justify-between",
                    difficulty.label === val.label 
                      ? "bg-emerald-500/10 border-emerald-500 text-emerald-400" 
                      : "bg-transparent border-[#1a2421] text-emerald-900 hover:border-emerald-800 hover:text-emerald-700"
                  )}
                >
                  {val.label}
                  {difficulty.label === val.label && <Check className="w-3 h-3" />}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Game Board Container */}
        <div className="relative border border-[#1a2421] p-2 bg-[#050807] rounded-xl shadow-2xl overflow-auto game-scroll max-w-[90vw] max-h-[70vh]">
          <div 
            className="grid gap-px bg-[#1a2421]"
            style={{ 
              gridTemplateColumns: `repeat(${difficulty.cols}, ${CELL_SIZE}px)`,
              width: difficulty.cols * CELL_SIZE + (difficulty.cols - 1),
            }}
          >
            {board.map((row, r) => 
              row.map((cell, c) => (
                <div
                  key={`${r}-${c}`}
                  onClick={() => handleCellClick(r, c)}
                  onContextMenu={(e) => handleContextMenu(e, r, c)}
                  onDoubleClick={() => handleChording(r, c)}
                  className={cn(
                    "cell w-8 h-8 flex items-center justify-center text-xs font-bold cursor-pointer relative",
                    cell.isRevealed ? "cell-revealed" : "bg-[#0a0f0d]",
                    gameStatus === "lost" && cell.isMine && !cell.isFlagged && "bg-red-950/20",
                    gameStatus === "won" && cell.isMine && "bg-emerald-950/20"
                  )}
                >
                  {cell.isRevealed ? (
                    cell.isMine ? (
                      <Bomb className={cn("w-4 h-4", gameStatus === "lost" ? "text-red-500" : "text-emerald-500")} />
                    ) : (
                      cell.neighborCount > 0 && (
                        <span className={cn(
                          "glow font-black text-lg font-mono",
                          [
                            null, 
                            "text-blue-400",    // 1
                            "text-emerald-400", // 2
                            "text-red-400",     // 3
                            "text-indigo-400",  // 4
                            "text-amber-400",   // 5
                            "text-cyan-400",    // 6
                            "text-purple-400",  // 7
                            "text-gray-400"     // 8
                          ][cell.neighborCount]
                        )}>
                          {cell.neighborCount}
                        </span>
                      )
                    )
                  ) : (
                    cell.isFlagged ? (
                      <Flag className="w-4 h-4 text-emerald-500 shadow-[0_0_8px_#00ff41]" />
                    ) : null
                  )}
                  
                  {/* Subtle grid decoration */}
                  {!cell.isRevealed && (
                    <div className="absolute inset-0 border border-emerald-900/5 pointer-events-none" />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Game Over Overlays */}
          <AnimatePresence>
            {(gameStatus === "won" || gameStatus === "lost") && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0f0d]/60 backdrop-blur-md z-50 p-6 text-center"
              >
                <motion.div
                  initial={{ scale: 0.9, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  className={cn(
                    "p-8 border rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)]",
                    gameStatus === "won" ? "border-emerald-500/50 bg-emerald-950/20" : "border-red-500/50 bg-red-950/20"
                  )}
                >
                  <h2 className={cn(
                    "text-4xl font-black mb-2 tracking-tighter",
                    gameStatus === "won" ? "text-emerald-400" : "text-red-500"
                  )}>
                    {gameStatus === "won" ? "MISSION SUCCESS" : "TERMINATED"}
                  </h2>
                  <p className="text-emerald-900 font-bold mb-6 tracking-widest text-sm">
                    {gameStatus === "won" ? "ALL THREATS NEUTRALIZED" : "CRITICAL SYSTEM FAILURE"}
                  </p>
                  
                  <div className="flex gap-4 justify-center">
                    <button 
                      onClick={resetGame}
                      className={cn(
                        "px-8 py-3 rounded-lg font-black tracking-widest transition-all",
                        gameStatus === "won" 
                          ? "bg-emerald-500 text-black hover:bg-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.4)]" 
                          : "bg-red-500 text-black hover:bg-red-400 shadow-[0_0_20px_rgba(239,68,68,0.4)]"
                      )}
                    >
                      TRY AGAIN
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer info */}
        <div className="mt-6 flex items-center justify-between text-[10px] text-emerald-900 font-bold tracking-widest uppercase">
          <div className="flex gap-4">
            <span>Grid: {difficulty.rows}x{difficulty.cols}</span>
            <span>OS: NeoTerm_v1.0.4</span>
          </div>
          <div className="flex gap-4">
            <span>[L-CLICK] REVEAL</span>
            <span>[R-CLICK] FLAG</span>
            <span>[DBL-CLICK] CHORD</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById("root"));
root.render(<App />);