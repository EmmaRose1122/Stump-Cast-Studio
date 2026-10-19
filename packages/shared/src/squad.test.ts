import { describe, expect, it } from 'vitest';
import { parseSquadFile } from './squad';

describe('parseSquadFile', () => {
  it('parses JSON array of player names', () => {
    const json = JSON.stringify(['Aiden Markram', 'Temba Bavuma', 'Pat Cummins']);
    const res = parseSquadFile(json, 'Proteas');
    expect(res.allPlayers).toHaveLength(3);
    expect(res.teams).toHaveLength(1);
    expect(res.teams[0]!.name).toBe('Proteas');
    expect(res.allPlayers.map((p) => p.name)).toEqual(['Aiden Markram', 'Temba Bavuma', 'Pat Cummins']);
  });

  it('parses JSON structured multi-team squad', () => {
    const json = JSON.stringify({
      teams: [
        {
          name: 'South Africa',
          players: [
            { name: 'Aiden Markram', role: 'Batter', isCaptain: true },
            { name: 'Kyle Verreynne', role: 'WK-Batter', isWK: true },
          ],
        },
        {
          name: 'Australia',
          players: [
            { name: 'Pat Cummins', role: 'Bowler', tag: 'C' },
            { name: 'Travis Head', role: 'Batter' },
          ],
        },
      ],
    });
    const res = parseSquadFile(json);
    expect(res.teams).toHaveLength(2);
    expect(res.teams[0]!.name).toBe('South Africa');
    expect(res.teams[0]!.players[0]!.tag).toBe('C');
    expect(res.teams[0]!.players[1]!.tag).toBe('WK');
    expect(res.teams[1]!.name).toBe('Australia');
    expect(res.allPlayers).toHaveLength(4);
  });

  it('parses CSV with standard headers (Name, Role, Team, Tag)', () => {
    const csv = `Player Name,Role,Team,Status
"Markram, Aiden",Batter,South Africa,C
"Cummins, Pat",Bowler,Australia,C
"Verreynne, Kyle",WK-Batter,South Africa,WK`;

    const res = parseSquadFile(csv);
    expect(res.allPlayers).toHaveLength(3);
    expect(res.allPlayers[0]!.name).toBe('Markram, Aiden');
    expect(res.allPlayers[0]!.team).toBe('South Africa');
    expect(res.allPlayers[0]!.tag).toBe('C');
    expect(res.teams).toHaveLength(2);
  });

  it('parses simple newline/comma list without headers gracefully', () => {
    const text = `Babar Azam
Mohammad Rizwan
Shaheen Afridi`;

    const res = parseSquadFile(text, 'Pakistan');
    expect(res.teams[0]!.name).toBe('Pakistan');
    expect(res.allPlayers.map((p) => p.name)).toEqual([
      'Babar Azam',
      'Mohammad Rizwan',
      'Shaheen Afridi',
    ]);
  });
});
