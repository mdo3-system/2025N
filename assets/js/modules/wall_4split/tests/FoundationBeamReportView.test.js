/**
 * FoundationBeamReportView.test.js
 * Unit Test for FoundationBeamReportView HTML report generator
 */

const { describe, it } = window.TestRunner;

describe('FoundationBeamReportView (v3.3.0)', () => {
    it('should return valid HTML report for normal beam stress data', () => {
        if (!window.FoundationBeamReportView) {
            throw new Error('FoundationBeamReportView module is not loaded');
        }

        const mockBeam = {
            props: { symbol: 'FG1' },
            fdStress: {
                isNG: false,
                pillars: [
                    { name: 'X1-Y1', x: 0 },
                    { name: 'X2-Y1', x: 2.0 }
                ],
                seismic: {
                    leftward: { Td: [0, 0], R: [0, 0], Qe: [0, 0], Mf: [0, 0] },
                    rightward: { Td: [0, 0], R: [0, 0], Qe: [0, 0], Mf: [0, 0] }
                },
                spans: [
                    {
                        spanName: '1-2/A',
                        L: 2.0,
                        sigma_e: 15.0,
                        B_trib: 0.5,
                        M_mid: 5.0,
                        M_end: 3.3,
                        Q_L: 10.0,
                        leftward: { M_left: 10.5, M_right: 12.3, Q: 15.0, rM_left: 0.5, rM_right: 0.6, rQ: 0.4 },
                        rightward: { M_left: 11.0, M_right: 11.5, Q: 14.2, rM_left: 0.52, rM_right: 0.55, rQ: 0.38 },
                        cap: { h: 600, b: 150, j: 450, sMa_top: 25.0, lMa_top: 25.0, sMa_bot: 25.0, lMa_bot: 25.0, pw: 0.002, lQa: 50.0, sQa_L: 75.0, sQa_R: 75.0 },
                        rM_L: 0.45,
                        rQ_L: 0.30,
                        isNG: false
                    }
                ]
            }
        };

        const html = window.FoundationBeamReportView.generateBeamReportHtml(mockBeam);

        if (!html || typeof html !== 'string') {
            throw new Error('HTML generation returned null or non-string');
        }

        if (!html.includes('基礎梁断面検定 計算書') || !html.includes('FG1')) {
            throw new Error(`Generated HTML missing key section headers: ${html.substring(0, 200)}`);
        }

        if (!html.includes('OK')) {
            throw new Error('Generated HTML missing expected status badge OK');
        }
    });

    it('should return fallback message when beam stress data is null', () => {
        const html = window.FoundationBeamReportView.generateBeamReportHtml(null);
        if (!html.includes('計算データがありません')) {
            throw new Error('Fallback warning message not generated for null beam');
        }
    });
});
