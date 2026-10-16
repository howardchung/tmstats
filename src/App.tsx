import { useState, useEffect, useMemo } from "react";
import {
  MantineProvider,
  Table,
  Title,
  Progress,
  Group,
  Text,
  Grid,
  Checkbox,
  Button,
} from "@mantine/core";
import "@mantine/core/styles.css";

import "./App.css";

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
  "#800000",
  "#aaffc3",
  "#808000",
  "#ffd8b1",
  "#000075",
  "#a9a9a9",
  "#ffffff",
  "#000000",
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
    <MantineProvider defaultColorScheme="dark">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          flexDirection: "column",
          gap: "4px",
        }}
      >
        <Button
          component="a"
          target="_blank"
          href="https://mars.howardchung.net"
        >
          Play a game
        </Button>
        <Checkbox
          checked={inPersonOnly}
          onChange={(event) => setInPersonOnly(event.currentTarget.checked)}
          label="Show in-person only"
        />
      </div>
      <Grid columns={24}>
        <Grid.Col span={{ lg: 4, base: 24 }}>
          <Title order={3}>Players</Title>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th></Table.Th>
                  <Table.Th>Player</Table.Th>
                  <Table.Th>Elo</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {players
                  .sort(
                    (a, b) =>
                      (eloRatings.get(b) ?? 0) - (eloRatings.get(a) ?? 0)
                  )
                  .map((p) => {
                    return (
                      <Table.Tr key={p}>
                        <Table.Td>
                          <Checkbox
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
                        <Table.Td>
                          <Title order={5} c={playerColors.get(p)}>
                            {p}{" "}
                          </Title>
                          <div>
                            ({pWins.get(p) ?? 0}
                            {" - "}
                            {(pGames.get(p) ?? 0) - (pWins.get(p) ?? 0)})
                          </div>
                        </Table.Td>
                        <Table.Td>
                          <Title order={6} c={playerColors.get(p)}>
                            {eloRatings.get(p)?.toFixed(0)}
                          </Title>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
              </Table.Tbody>
            </Table>
          </div>
        </Grid.Col>
        <Grid.Col span={{ lg: 8, base: 24 }}>
          <Title order={3}>Games</Title>
          <div className="mobileScroll">
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th onClick={() => setGameSortKey("createdTimeMs")}>
                    Info
                  </Table.Th>
                  <Table.Th>Result</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {sortedGames.map((d: any) => {
                  return (
                    <Table.Tr key={d.createdTimeMs}>
                      <Table.Td>
                        <div>
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
                          <div>
                            {`${Math.floor(d.durationMs / 1000 / 60)}:${(
                              Math.floor(d.durationMs / 1000) % 60
                            )
                              .toString()
                              .padStart(2, "0")}`}{" "}
                            ({d.generations}g)
                          </div>
                          <div>{d.map}</div>
                        </div>
                      </Table.Td>
                      <Table.Td>
                        {d.players.map((target: any, i: number) => {
                          const trackedP = players.find(
                            (p2: string) => p2 === target.name?.trim()
                          );
                          const winnerScore = d.players[d.winner]?.score;
                          return (
                            <div
                              style={{
                                display: "flex",
                                gap: "2px",
                                marginBottom: "2px",
                              }}
                            >
                              <span style={{ width: "120px" }}>
                                <Text
                                  c={playerColors.get(trackedP)}
                                  size="xs"
                                  fw={d.winner === i ? 700 : 400}
                                >
                                  {target?.name} ({target?.curr?.toFixed(0)})
                                </Text>
                                <Text size="xs">
                                  {target?.delta > 0 ? "+" : ""}
                                  {target?.delta?.toFixed(1)}
                                </Text>
                              </span>
                              <Progress.Root
                                size={18}
                                key={trackedP}
                                style={{ width: "100%" }}
                              >
                                <Progress.Section
                                  value={(target?.score / winnerScore) * 100}
                                  color={playerColors.get(trackedP)}
                                  style={{ justifyContent: "start" }}
                                >
                                  <Progress.Label>
                                    {target?.corp ?? ""}
                                  </Progress.Label>
                                </Progress.Section>
                                <span
                                  style={{
                                    position: "absolute",
                                    right: "2px",
                                    color: "white",
                                    fontWeight: 700,
                                    fontSize: 10,
                                  }}
                                >
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
          </div>
        </Grid.Col>
        <Grid.Col span={{ lg: 6, base: 24 }}>
          <Title order={3}>Corps</Title>
          <div className="mobileScroll">
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th onClick={() => setCorpSortKey("played")}>
                    Played
                  </Table.Th>
                  <Table.Th onClick={() => setCorpSortKey("win")}>
                    Win%
                  </Table.Th>
                  {/* <Table.Th onClick={() => setCorpSortKey("avggen")}>
                    Avg.Gens
                  </Table.Th> */}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {sortedCorps.map(([k, v]) => (
                  <Table.Tr key={k}>
                    <Table.Td>
                      {" "}
                      {k}
                      <SplitBar
                        values={players.map((p) => ({
                          label: p,
                          value: pCorps.get(p)?.get(k) ?? 0,
                        }))}
                        playerColors={playerColors}
                      />
                    </Table.Td>
                    <Table.Td>{v}</Table.Td>
                    <Table.Td>
                      <PercentBar value={((corpWins.get(k) ?? 0) / v) * 100} />
                    </Table.Td>
                    {/* <Table.Td>
                      {((corpGens.get(k) ?? 0) / v).toFixed(2)}
                    </Table.Td> */}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </div>
          <Title order={3}>Milestones</Title>
          <div className="mobileScroll">
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th onClick={() => setCardSortKey("played")}>
                    Claimed
                  </Table.Th>
                  <Table.Th onClick={() => setCardSortKey("win")}>
                    Win%
                  </Table.Th>
                  {/* <Table.Th onClick={() => setCardSortKey("avggen")}>
                    Avg.Gens
                  </Table.Th> */}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {sortedMilestones.map(([k, v]) => (
                  <Table.Tr key={k}>
                    <Table.Td>
                      <div>
                        {k}
                        <SplitBar
                          values={players.map((p) => ({
                            label: p,
                            value: pMilestones.get(p)?.get(k) ?? 0,
                          }))}
                          playerColors={playerColors}
                        />
                      </div>
                    </Table.Td>
                    <Table.Td>{v}</Table.Td>
                    <Table.Td>
                      <PercentBar
                        value={((milestoneWins.get(k) ?? 0) / v) * 100}
                      />
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </div>
          <Title order={3}>Awards</Title>
          <div className="mobileScroll">
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th onClick={() => setCardSortKey("played")}>
                    Funded
                  </Table.Th>
                  <Table.Th onClick={() => setCardSortKey("win")}>
                    Win%
                  </Table.Th>
                  {/* <Table.Th onClick={() => setCardSortKey("avggen")}>
                    Avg.Gens
                  </Table.Th> */}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {sortedAwards.map(([k, v]) => (
                  <Table.Tr key={k}>
                    <Table.Td>
                      <div>
                        {k}
                        <SplitBar
                          values={players.map((p) => ({
                            label: p,
                            value: pAwards.get(p)?.get(k) ?? 0,
                          }))}
                          playerColors={playerColors}
                        />
                      </div>
                    </Table.Td>
                    <Table.Td>{v}</Table.Td>
                    <Table.Td>
                      <PercentBar value={((awardWins.get(k) ?? 0) / v) * 100} />
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </div>
        </Grid.Col>
        <Grid.Col span={{ lg: 6, base: 24 }}>
          <Title order={3}>Cards</Title>
          <div className="mobileScroll">
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th onClick={() => setCardSortKey("played")}>
                    Played
                  </Table.Th>
                  <Table.Th onClick={() => setCardSortKey("win")}>
                    Win%
                  </Table.Th>
                  {/* <Table.Th onClick={() => setCardSortKey("avggen")}>
                    Avg.Gens
                  </Table.Th> */}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {sortedCards.map(([k, v]) => (
                  <Table.Tr key={k}>
                    <Table.Td>
                      <div>
                        {k}
                        <SplitBar
                          values={players.map((p) => ({
                            label: p,
                            value: pCards.get(p)?.get(k) ?? 0,
                          }))}
                          playerColors={playerColors}
                        />
                      </div>
                    </Table.Td>
                    <Table.Td>{v}</Table.Td>
                    <Table.Td>
                      <PercentBar value={((cardWins.get(k) ?? 0) / v) * 100} />
                    </Table.Td>
                    {/* <Table.Td>
                      {((cardGens.get(k) ?? 0) / v).toFixed(2)}
                    </Table.Td> */}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </div>
        </Grid.Col>
      </Grid>
    </MantineProvider>
  );
}

function PercentBar({ value }: { value: number }) {
  return (
    <div>
      <Group justify="space-between">
        <Text fz="xs" c={value > 50 ? "green" : "red"} fw={700}>
          {value.toFixed(1)}%
        </Text>
      </Group>
      <Progress.Root>
        <Progress.Section value={value} color={value > 50 ? "green" : "red"} />
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
      <Progress.Root size={14} classNames={{ label: "label" }}>
        {values.map((v, i) => {
          if (!v) {
            return null;
          }
          return (
            <Progress.Section
              key={i}
              value={(v.value / sum) * 100}
              color={playerColors.get(v.label)}
              title={v.label}
            >
              <Progress.Label>{v.value}</Progress.Label>
            </Progress.Section>
          );
        })}
      </Progress.Root>
    </div>
  );
}

export default App;
