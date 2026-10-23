import React, { useState, useEffect, useMemo } from "react";
import {
  MantineProvider,
  createTheme,
  Table,
  Progress,
  Text,
  Grid,
  Checkbox,
  Switch,
  Button,
} from "@mantine/core";
import "@mantine/core/styles.css";

import "./App.css";

const theme = createTheme({
  primaryColor: "mars",
  primaryShade: 5,
  fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  headings: { fontFamily: '"Space Grotesk", Inter, sans-serif' },
  defaultRadius: "md",
  colors: {
    mars: [
      "#fff1e8",
      "#ffdcc6",
      "#ffbf94",
      "#ffa062",
      "#f98638",
      "#ef6f1d",
      "#d85a12",
      "#b54610",
      "#92370f",
      "#6e290c",
    ],
  },
});

// Pick black or white text depending on how light the bar color is
function textOn(hex: string | undefined) {
  if (!hex) return "#fff";
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? "#1a120d" : "#fff";
}

async function fetchData(updater: (data: any) => void) {
  // netlify functions proxies the original http data to https
  const resp = await fetch(
    // "https://marsstats.netlify.app/.netlify/functions/stats"
    "https://mars.howardchung.net/api/stats",
  );
  const data = await resp.json();
  updater({ games: data.data });
}

// 20 colors from https://sashamaps.net/docs/resources/20-colors/
const colors = [
  "#3cb44b",
  "#e6194B",
  "#ffe119",
  "#4363d8",
  "#f58231",
  "#911eb4",
  "#42d4f4",
  "#f032e6",
  "#bfef45",
  "#fabed4",
  "#469990",
  "#dcbeff",
  "#9A6324",
  "#fffac8",
  "#c0392b",
  "#aaffc3",
  "#a4a42a",
  "#ffd8b1",
  "#5c6bc0",
  "#a9a9a9",
  "#ffffff",
  "#78909c",
];

function computeElo(games: any[]) {
  console.time("elo");
  // Reverse to get games in order for rating
  games.reverse();
  const result = new Map<string, number>();
  const init = 1000;
  // each match can update by up to k
  const k = 32;
  games
    //.slice(0, 2)
    .forEach((g) => {
      const deltas = new Map<string, number>();
      // Iterate over all games
      // If more than 2 players, divide k by (players - 1)
      const adjustedK = k / (g.players.length - 1);
      // Get all pairs and result
      const pairs: [string, string, number][] = [];
      for (let i = 0; i < g.players.length; i++) {
        for (let j = i + 1; j < g.players.length; j++) {
          const p1 = g.players[i];
          const p2 = g.players[j];
          // Figure out all pairwise matchups, win-loss is whether player finished ahead or behind of other player
          if (p1.tieBreakScore !== p2.tieBreakScore) {
            pairs.push([
              p1.name.trim(),
              p2.name.trim(),
              p1.tieBreakScore > p2.tieBreakScore ? 0 : 1,
            ]);
          }
        }
      }
      // console.log(pairs);
      pairs.forEach((pair) => {
        // first time encountering each player, set to init
        const currRating1 = result.get(pair[0]) ?? init;
        const currRating2 = result.get(pair[1]) ?? init;

        const r1 = 10 ** (currRating1 / 400);
        const r2 = 10 ** (currRating2 / 400);
        const e1 = r1 / (r1 + r2);
        const e2 = r2 / (r1 + r2);
        const win1 = pair[2] === 0 ? 1 : 0;
        const win2 = pair[2] === 1 ? 1 : 0;
        // Compute deltas
        const ratingDiff1 = adjustedK * (win1 - e1);
        const ratingDiff2 = adjustedK * (win2 - e2);
        //console.log(currRating1, r1, e1, win1, ratingDiff1);
        deltas.set(pair[0], (deltas.get(pair[0]) ?? 0) + ratingDiff1);
        deltas.set(pair[1], (deltas.get(pair[1]) ?? 0) + ratingDiff2);
      });
      //console.log(deltas);
      // Add delta to each player so we can display in table rows
      for (let i = 0; i < g.players.length; i++) {
        g.players[i].delta = deltas.get(g.players[i].name.trim());
        g.players[i].curr = result.get(g.players[i].name.trim()) ?? init;
      }
      // Update result
      Array.from(deltas.entries()).forEach(([k, v]) => {
        result.set(k, (result.get(k) ?? init) + v);
      });
      //console.log(result);
    });
  console.timeEnd("elo");
  return { eloRatings: result, games: games.reverse() };
}

function App() {
  const [data, setData] = useState({
    games: [],
    eloRatings: new Map<string, number>(),
  });
  const [selectedPlayers, setSelectedPlayers] = useState(
    new Map<string, boolean>()
  );
  const [inPersonOnly, setInPersonOnly] = useState(false);
  useEffect(() => {
    fetchData(setData);
  }, []);
  // Assign players based on reverse game order
  const playerColors = new Map();
  const players: string[] = Array.from(
    new Set(
      data.games
        .slice()
        .reverse()
        .map((g: any) => g.players.map((p: any) => p.name.trim()))
        .flat()
    )
  );
  // Assign colors based on the original order
  players.forEach((p, i) => {
    playerColors.set(p, colors[i]);
  });

  let gamesToRate = inPersonOnly
    ? data.games.filter((g: any) => !g.gameId)
    : data.games;
  // This function also modifies the games array with elo delta data
  const { eloRatings, games } = computeElo(gamesToRate.slice());

  // UI allows showing only matches played by a particular player
  const filtered = useMemo(() => {
    return games.filter((d: any) => {
      const selectedArr = Array.from(selectedPlayers.keys()).filter((p) =>
        selectedPlayers.get(p)
      );
      const gPlayers = d.players.map((p2: any) => p2.name.trim());
      return (
        selectedArr.length === 0 ||
        selectedArr.every((p) => gPlayers.includes(p))
      );
    });
  }, [games, selectedPlayers]);

  const corpCounts = new Map();
  const corpWins = new Map();
  const corpGens = new Map();
  const cardCounts = new Map();
  const cardWins = new Map();
  const cardGens = new Map();
  const milestoneCounts = new Map();
  const milestoneWins = new Map();
  const awardCounts = new Map();
  const awardWins = new Map();
  const pCards = new Map<string, Map<string, number>>();
  const pCorps = new Map<string, Map<string, number>>();
  const pMilestones = new Map<string, Map<string, number>>();
  const pAwards = new Map<string, Map<string, number>>();
  const pWins = new Map<string, number>();
  const pGames = new Map<string, number>();

  players.forEach((p) => {
    pCards.set(p, new Map());
    pCorps.set(p, new Map());
    pMilestones.set(p, new Map());
    pAwards.set(p, new Map());
  });

  filtered.forEach((d: any) => {
    const winnerName = d.players[d.winner].name.trim();
    pWins.set(winnerName, (pWins.get(winnerName) ?? 0) + 1);
    d.claimedMilestones.forEach((ms: any) => {
      milestoneCounts.set(ms.name, (milestoneCounts.get(ms.name) ?? 0) + 1);
      if (d.players.findIndex((p: any) => p.id === ms.playerId) === d.winner) {
        milestoneWins.set(ms.name, (milestoneWins.get(ms.name) ?? 0) + 1);
      }
    });
    d.fundedAwards.forEach((award: any) => {
      awardCounts.set(award.name, (awardCounts.get(award.name) ?? 0) + 1);
      if (
        d.players.findIndex((p: any) => p.id === award.playerId) === d.winner
      ) {
        awardWins.set(award.name, (awardWins.get(award.name) ?? 0) + 1);
      }
    });
    d.players.forEach((p: any) => {
      if (p.corp) {
        corpCounts.set(p.corp, (corpCounts.get(p.corp) ?? 0) + 1);
        corpGens.set(p.corp, (corpGens.get(p.corp) ?? 0) + d.generations);
        if (p.id === d.players[d.winner].id) {
          corpWins.set(p.corp, (corpWins.get(p.corp) ?? 0) + 1);
        }
      }
      const pName = p.name.trim();
      pGames.set(pName, (pGames.get(pName) ?? 0) + 1);
      const target = pCorps.get(pName);
      if (target) {
        target.set(p.corp, (target.get(p.corp) ?? 0) + 1);
      }
      p.cards.forEach((c: any) => {
        cardCounts.set(c, (cardCounts.get(c) ?? 0) + 1);
        cardGens.set(c, (cardGens.get(c) ?? 0) + d.generations);
        if (p.id === d.players[d.winner].id) {
          cardWins.set(c, (cardWins.get(c) ?? 0) + 1);
        }
        const target = pCards.get(pName);
        if (target) {
          target.set(c, (target.get(c) ?? 0) + 1);
        }
      });
      d.claimedMilestones.forEach((ms: any) => {
        if (ms.playerId === p.id) {
          const target = pMilestones.get(pName);
          if (target) {
            target.set(ms.name, (target.get(ms.name) ?? 0) + 1);
          }
        }
      });
      d.fundedAwards.forEach((award: any) => {
        if (award.playerId === p.id) {
          const target = pAwards.get(pName);
          if (target) {
            target.set(award.name, (target.get(award.name) ?? 0) + 1);
          }
        }
      });
    });
  });
  const [gameSortKey, setGameSortKey] = useState<string>("");
  let gameSortFn = (a: any) => a["createdTimeMs"];
  switch (gameSortKey) {
    case "createdTimeMs":
    case "durationMs":
      gameSortFn = (a: any) => a[gameSortKey];
      break;
  }
  const sortedGames = filtered.sort((a, b) => gameSortFn(b) - gameSortFn(a));
  const [corpSortKey, setCorpSortKey] = useState<string>("");
  let corpSortFn = (a: any) => a[1];
  switch (corpSortKey) {
    case "played":
      corpSortFn = ([_k, v]) => v;
      break;
    case "win":
      corpSortFn = ([k, v]) => (corpWins.get(k) ?? 0) / v;
      break;
    case "avggen":
      corpSortFn = ([k, v]) => (corpGens.get(k) ?? 0) / v;
      break;
  }
  const sortedCorps = Array.from(corpCounts.entries()).sort(
    (a, b) => corpSortFn(b) - corpSortFn(a)
  );
  const [cardSortKey, setCardSortKey] = useState<string>("");
  let cardSortFn = (a: any) => a[1];
  switch (cardSortKey) {
    case "played":
      cardSortFn = ([_k, v]) => v;
      break;
    case "win":
      cardSortFn = ([k, v]) => (cardWins.get(k) ?? 0) / v;
      break;
    case "avggen":
      cardSortFn = ([k, v]) => (cardGens.get(k) ?? 0) / v;
      break;
  }
  const sortedCards = Array.from(cardCounts.entries()).sort(
    (a, b) => cardSortFn(b) - cardSortFn(a)
  );
  let milestoneSortFn = (a: any) => a[1];
  const sortedMilestones = Array.from(milestoneCounts.entries()).sort(
    (a, b) => milestoneSortFn(b) - milestoneSortFn(a)
  );
  let awardSortFn = (a: any) => a[1];
  const sortedAwards = Array.from(awardCounts.entries()).sort(
    (a, b) => awardSortFn(b) - awardSortFn(a)
  );
  return (
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <div className="app">
        <header className="hero">
          <div>
            <span className="eyebrow">Elo ratings &amp; stats</span>
            <h1>Terraforming Mars</h1>
            <p>
              Leaderboard and card statistics, updated automatically with new
              games.
            </p>
          </div>
          <div className="hero-actions">
            <Switch
              checked={inPersonOnly}
              onChange={(event) => setInPersonOnly(event.currentTarget.checked)}
              label="In-person games only"
            />
            <Button
              component="a"
              target="_blank"
              href="https://mars.howardchung.net"
              style={{ textDecoration: "none" }}
            >
              Play a game
            </Button>
          </div>
        </header>
        <Grid columns={24} gutter="lg">
          <Grid.Col span={{ lg: 4.5, base: 24 }}>
            <Panel title="Players" count={players.length}>
              <Table verticalSpacing="xs" horizontalSpacing="xs" highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th></Table.Th>
                    <Table.Th></Table.Th>
                    <Table.Th>Player</Table.Th>
                    <Table.Th className="num">Elo</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {players
                    .sort(
                      (a, b) =>
                        (eloRatings.get(b) ?? 0) - (eloRatings.get(a) ?? 0)
                    )
                    .map((p, rank) => {
                      return (
                        <Table.Tr key={p}>
                          <Table.Td>
                            <Checkbox
                              size="xs"
                              aria-label={`Filter games by ${p}`}
                              value={Boolean(selectedPlayers.get(p)).toString()}
                              onChange={(event: any) => {
                                const newSelectedPlayers = new Map(
                                  selectedPlayers
                                );
                                newSelectedPlayers.set(
                                  p,
                                  event.currentTarget.checked
                                );
                                setSelectedPlayers(newSelectedPlayers);
                              }}
                            />
                          </Table.Td>
                          <Table.Td className={`rank ${rank < 3 ? "top" : ""}`}>
                            {rank + 1}
                          </Table.Td>
                          <Table.Td>
                            <div className="player-name">
                              <span
                                className="player-dot"
                                style={{ background: playerColors.get(p) }}
                              />
                              <span style={{ color: playerColors.get(p) }}>
                                {p}
                              </span>
                            </div>
                            <div className="player-record">
                              {pWins.get(p) ?? 0}W &ndash;{" "}
                              {(pGames.get(p) ?? 0) - (pWins.get(p) ?? 0)}L
                            </div>
                          </Table.Td>
                          <Table.Td className="num">
                            <span className="player-elo">
                              {eloRatings.get(p)?.toFixed(0)}
                            </span>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                </Table.Tbody>
              </Table>
            </Panel>
          </Grid.Col>
          <Grid.Col span={{ lg: 9.5, base: 24 }}>
            <Panel title="Games" count={sortedGames.length} tall>
              <Table verticalSpacing="xs" horizontalSpacing="xs" highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <SortTh
                      active={gameSortKey === "" || gameSortKey === "createdTimeMs"}
                      onClick={() => setGameSortKey("createdTimeMs")}
                    >
                      Date
                    </SortTh>
                    <Table.Th>Result</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {sortedGames.map((d: any) => {
                    return (
                      <Table.Tr key={d.createdTimeMs}>
                        <Table.Td>
                          <div className="game-info">
                            <a
                              href={`https://mars.howardchung.net/game?id=${d.gameId}`}
                            >
                              {new Date(d.createdTimeMs).toLocaleString("en", {
                                hour12: false,
                                hour: "2-digit",
                                minute: "2-digit",
                                year: "numeric",
                                month: "short",
                                day: "2-digit",
                              })}
                            </a>
                            <div className="game-meta">
                              {`${Math.floor(d.durationMs / 1000 / 60)}:${(
                                Math.floor(d.durationMs / 1000) % 60
                              )
                                .toString()
                                .padStart(2, "0")}`}{" "}
                              &middot; {d.generations} gen
                            </div>
                            <div className="game-meta">{d.map}</div>
                          </div>
                        </Table.Td>
                        <Table.Td>
                          {d.players.map((target: any, i: number) => {
                            const trackedP = players.find(
                              (p2: string) => p2 === target.name?.trim()
                            );
                            const winnerScore = d.players[d.winner]?.score;
                            const barColor = playerColors.get(trackedP);
                            return (
                              <div className="result-row" key={`${i}-${target?.name}`}>
                                <div className="result-who">
                                  <Text
                                    className="result-name"
                                    c={barColor}
                                    fw={d.winner === i ? 700 : 500}
                                  >
                                    {d.winner === i ? "\u2605 " : ""}
                                    {target?.name} ({target?.curr?.toFixed(0)})
                                  </Text>
                                  <span
                                    className={`result-delta ${
                                      target?.delta > 0 ? "up" : "down"
                                    }`}
                                  >
                                    {target?.delta > 0 ? "+" : ""}
                                    {target?.delta?.toFixed(1)}
                                  </span>
                                </div>
                                <Progress.Root
                                  size={20}
                                  key={trackedP}
                                  className="result-bar"
                                >
                                  <Progress.Section
                                    value={(target?.score / winnerScore) * 100}
                                    color={barColor}
                                    style={{ justifyContent: "start" }}
                                  >
                                    <Progress.Label className="corp-label" c={textOn(barColor)}>
                                      {target?.corp ?? ""}
                                    </Progress.Label>
                                  </Progress.Section>
                                  <span className="score-label">
                                    {target?.score}
                                  </span>
                                </Progress.Root>
                              </div>
                            );
                          })}
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </Panel>
          </Grid.Col>
          <Grid.Col span={{ lg: 5, base: 24 }}>
            <Panel title="Corps" count={sortedCorps.length}>
              <Table verticalSpacing="xs" horizontalSpacing="xs" highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Name</Table.Th>
                    <SortTh
                      className="num"
                      active={corpSortKey === "" || corpSortKey === "played"}
                      onClick={() => setCorpSortKey("played")}
                    >
                      Played
                    </SortTh>
                    <SortTh
                      active={corpSortKey === "win"}
                      onClick={() => setCorpSortKey("win")}
                    >
                      Win %
                    </SortTh>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {sortedCorps.map(([k, v]) => (
                    <Table.Tr key={k}>
                      <Table.Td>
                        <div className="stat-name">{k}</div>
                        <SplitBar
                          values={players.map((p) => ({
                            label: p,
                            value: pCorps.get(p)?.get(k) ?? 0,
                          }))}
                          playerColors={playerColors}
                        />
                      </Table.Td>
                      <Table.Td className="num">{v}</Table.Td>
                      <Table.Td style={{ minWidth: 72 }}>
                        <PercentBar value={((corpWins.get(k) ?? 0) / v) * 100} />
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Panel>
            <Panel title="Milestones" count={sortedMilestones.length}>
              <Table verticalSpacing="xs" horizontalSpacing="xs" highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Name</Table.Th>
                    <Table.Th className="num">Claimed</Table.Th>
                    <Table.Th>Win %</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {sortedMilestones.map(([k, v]) => (
                    <Table.Tr key={k}>
                      <Table.Td>
                        <div className="stat-name">{k}</div>
                        <SplitBar
                          values={players.map((p) => ({
                            label: p,
                            value: pMilestones.get(p)?.get(k) ?? 0,
                          }))}
                          playerColors={playerColors}
                        />
                      </Table.Td>
                      <Table.Td className="num">{v}</Table.Td>
                      <Table.Td style={{ minWidth: 72 }}>
                        <PercentBar
                          value={((milestoneWins.get(k) ?? 0) / v) * 100}
                        />
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Panel>
            <Panel title="Awards" count={sortedAwards.length}>
              <Table verticalSpacing="xs" horizontalSpacing="xs" highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Name</Table.Th>
                    <Table.Th className="num">Funded</Table.Th>
                    <Table.Th>Win %</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {sortedAwards.map(([k, v]) => (
                    <Table.Tr key={k}>
                      <Table.Td>
                        <div className="stat-name">{k}</div>
                        <SplitBar
                          values={players.map((p) => ({
                            label: p,
                            value: pAwards.get(p)?.get(k) ?? 0,
                          }))}
                          playerColors={playerColors}
                        />
                      </Table.Td>
                      <Table.Td className="num">{v}</Table.Td>
                      <Table.Td style={{ minWidth: 72 }}>
                        <PercentBar
                          value={((awardWins.get(k) ?? 0) / v) * 100}
                        />
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Panel>
          </Grid.Col>
          <Grid.Col span={{ lg: 5, base: 24 }}>
            <Panel title="Cards" count={sortedCards.length} tall>
              <Table verticalSpacing="xs" horizontalSpacing="xs" highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Name</Table.Th>
                    <SortTh
                      className="num"
                      active={cardSortKey === "" || cardSortKey === "played"}
                      onClick={() => setCardSortKey("played")}
                    >
                      Played
                    </SortTh>
                    <SortTh
                      active={cardSortKey === "win"}
                      onClick={() => setCardSortKey("win")}
                    >
                      Win %
                    </SortTh>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {sortedCards.map(([k, v]) => (
                    <Table.Tr key={k}>
                      <Table.Td>
                        <div className="stat-name">{k}</div>
                        <SplitBar
                          values={players.map((p) => ({
                            label: p,
                            value: pCards.get(p)?.get(k) ?? 0,
                          }))}
                          playerColors={playerColors}
                        />
                      </Table.Td>
                      <Table.Td className="num">{v}</Table.Td>
                      <Table.Td style={{ minWidth: 72 }}>
                        <PercentBar value={((cardWins.get(k) ?? 0) / v) * 100} />
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Panel>
          </Grid.Col>
        </Grid>
      </div>
    </MantineProvider>
  );
}

function Panel({
  title,
  count,
  tall,
  children,
}: {
  title: string;
  count?: number;
  tall?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h3>{title}</h3>
        {count !== undefined && <span className="panel-count">{count}</span>}
      </div>
      <div className={`panel-body ${tall ? "tall" : ""}`}>{children}</div>
    </section>
  );
}

function SortTh({
  active,
  onClick,
  className,
  children,
}: {
  active: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Table.Th
      className={`sortable ${active ? "active" : ""} ${className ?? ""}`}
      onClick={onClick}
      aria-sort={active ? "descending" : "none"}
    >
      {children}
      {active && <span className="sort-arrow">&#9660;</span>}
    </Table.Th>
  );
}

function PercentBar({ value }: { value: number }) {
  const good = value > 50;
  return (
    <div>
      <div className={`pct ${good ? "good" : "bad"}`}>{value.toFixed(1)}%</div>
      <Progress.Root size={6}>
        <Progress.Section value={value} color={good ? "green" : "red"} />
      </Progress.Root>
    </div>
  );
}

function SplitBar({
  values,
  playerColors,
}: {
  values: { label: string; value: number }[];
  playerColors: Map<string, string>;
}) {
  const sum = values.map((v) => v.value).reduce((a, b) => a + b, 0);
  return (
    <div style={{ width: "100%" }}>
      <Progress.Root size={16} classNames={{ label: "label" }}>
        {values.map((v, i) => {
          if (!v || !v.value) {
            return null;
          }
          const color = playerColors.get(v.label);
          return (
            <Progress.Section
              key={i}
              value={(v.value / sum) * 100}
              color={color}
              title={v.label}
            >
              <Progress.Label c={textOn(color)}>{v.value}</Progress.Label>
            </Progress.Section>
          );
        })}
      </Progress.Root>
    </div>
  );
}

export default App;
