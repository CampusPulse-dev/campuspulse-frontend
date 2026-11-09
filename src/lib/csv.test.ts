import { describe, expect, it } from 'vitest';
import { buildCsv, csvCell } from './csv';

describe('csvCell', () => {
  it('leaves plain values alone and renders null as empty', () => {
    expect(csvCell('Ada')).toBe('Ada');
    expect(csvCell(12)).toBe('12');
    expect(csvCell(true)).toBe('true');
    expect(csvCell(null)).toBe('');
  });

  it('quotes cells with commas, quotes and line breaks', () => {
    expect(csvCell('Ada, Obi')).toBe('"Ada, Obi"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('two\nlines')).toBe('"two\nlines"');
  });

  it('neutralises text a spreadsheet would run as a formula', () => {
    expect(csvCell('=SUM(A1:A9)')).toBe("'=SUM(A1:A9)");
    expect(csvCell('+234 801')).toBe("'+234 801");
    expect(csvCell('-1+1')).toBe("'-1+1");
    expect(csvCell('@cmd')).toBe("'@cmd");
  });

  it('does not touch real negative numbers', () => {
    expect(csvCell(-5)).toBe('-5');
  });
});

describe('buildCsv', () => {
  it('joins rows with CRLF and ends with a newline', () => {
    expect(buildCsv(['A', 'B'], [['x', 1]])).toBe('A,B\r\nx,1\r\n');
  });
});
