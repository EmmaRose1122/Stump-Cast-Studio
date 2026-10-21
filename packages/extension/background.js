"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // src/config/selectors.cricbuzz.json
  var selectors_cricbuzz_default = {
    version: 1,
    site: "cricbuzz",
    urlPatterns: [
      "^https?://(?:www\\.|m\\.)?cricbuzz\\.com/(?:live-cricket-scores|cricket-scores|live-cricket-scorecard|cricket-match-highlights|live-cricket-score|cricket-commentary|cricket-scorecard|cricket-match-facts|cricket-match-squads|live-cricket-scores-commentary|live-scores|cricket-series)/",
      "^https?://(?:www\\.|m\\.)?cricbuzz\\.com/live-cricket-score",
      "^https?://(?:www\\.|m\\.)?cricbuzz\\.com/cricket-scores",
      "^https?://(?:www\\.|m\\.)?cricbuzz\\.com/cricket-commentary",
      "^https?://(?:www\\.|m\\.)?cricbuzz\\.com/.*\\d+"
    ],
    matchIdRegex: "/(?:live-cricket-scores|cricket-scores|live-cricket-scorecard|cricket-match-highlights|live-cricket-score|cricket-commentary|cricket-scorecard|cricket-match-facts|cricket-match-squads)/(\\d+)",
    jsonTaps: [
      {
        urlRegex: "/api/mcenter/livescore/\\d+",
        map: {
          format: "miniscore.matchScoreDetails.matchFormat",
          status: "miniscore.status",
          battingTeam: "miniscore.batTeamScoreObj.teamName",
          score: "${miniscore.batTeam.teamScore}/${miniscore.batTeam.teamWkts}",
          overs: "miniscore.overs",
          "inn1.team": "miniscore.matchScoreDetails.inningsScoreList[0].batTeamName",
          "inn1.score": "${miniscore.matchScoreDetails.inningsScoreList[0].score}/${miniscore.matchScoreDetails.inningsScoreList[0].wickets}",
          "inn1.overs": "miniscore.matchScoreDetails.inningsScoreList[0].overs",
          "inn2.team": "miniscore.matchScoreDetails.inningsScoreList[1].batTeamName",
          "inn2.score": "${miniscore.matchScoreDetails.inningsScoreList[1].score}/${miniscore.matchScoreDetails.inningsScoreList[1].wickets}",
          "inn2.overs": "miniscore.matchScoreDetails.inningsScoreList[1].overs",
          "inn3.team": "miniscore.matchScoreDetails.inningsScoreList[2].batTeamName",
          "inn3.score": "${miniscore.matchScoreDetails.inningsScoreList[2].score}/${miniscore.matchScoreDetails.inningsScoreList[2].wickets}",
          "inn3.overs": "miniscore.matchScoreDetails.inningsScoreList[2].overs",
          "inn4.team": "miniscore.matchScoreDetails.inningsScoreList[3].batTeamName",
          "inn4.score": "${miniscore.matchScoreDetails.inningsScoreList[3].score}/${miniscore.matchScoreDetails.inningsScoreList[3].wickets}",
          "inn4.overs": "miniscore.matchScoreDetails.inningsScoreList[3].overs",
          "batter1.name": "${miniscore.batsmanStriker.name} *",
          "batter1.runs": "miniscore.batsmanStriker.runs",
          "batter1.balls": "miniscore.batsmanStriker.balls",
          "batter1.fours": "miniscore.batsmanStriker.fours",
          "batter1.sixes": "miniscore.batsmanStriker.sixes",
          "batter2.name": "miniscore.batsmanNonStriker.name",
          "batter2.runs": "miniscore.batsmanNonStriker.runs",
          "batter2.balls": "miniscore.batsmanNonStriker.balls",
          "batter2.fours": "miniscore.batsmanNonStriker.fours",
          "batter2.sixes": "miniscore.batsmanNonStriker.sixes",
          "bowler.name": "miniscore.bowlerStriker.name",
          "bowler.overs": "miniscore.bowlerStriker.overs",
          "bowler.maidens": "miniscore.bowlerStriker.maidens",
          "bowler.runs": "miniscore.bowlerStriker.runs",
          "bowler.wkts": "miniscore.bowlerStriker.wickets",
          partnership: "${miniscore.partnerShip.runs} (${miniscore.partnerShip.balls})",
          target: "miniscore.target",
          crr: "miniscore.currentRunRate",
          rrr: "miniscore.requiredRunRate",
          thisOver: "miniscore.recentOvsStats"
        }
      },
      {
        urlRegex: "/api/mcenter/comm/\\d+",
        map: {
          title: "${matchHeader.team1.name} vs ${matchHeader.team2.name}, ${matchHeader.matchDescription}, ${matchHeader.seriesDesc}",
          team1: "matchHeader.team1.name",
          team2: "matchHeader.team2.name",
          format: "matchHeader.matchFormat",
          toss: "${matchHeader.tossResults.tossWinnerName} won the toss and chose to ${matchHeader.tossResults.decision}",
          "inn1.team": "miniscore.matchScoreDetails.inningsScoreList[0].batTeamName",
          "inn1.score": "${miniscore.matchScoreDetails.inningsScoreList[0].score}/${miniscore.matchScoreDetails.inningsScoreList[0].wickets}",
          "inn1.overs": "miniscore.matchScoreDetails.inningsScoreList[0].overs",
          "inn2.team": "miniscore.matchScoreDetails.inningsScoreList[1].batTeamName",
          "inn2.score": "${miniscore.matchScoreDetails.inningsScoreList[1].score}/${miniscore.matchScoreDetails.inningsScoreList[1].wickets}",
          "inn2.overs": "miniscore.matchScoreDetails.inningsScoreList[1].overs"
        }
      }
    ],
    dom: {
      title: {
        selectors: ["h1.cb-nav-hdr", ".cb-nav-hdr", "h1 span.wb\\:block", "h1", "title", "h1 span:first-child"]
      },
      status: {
        selectors: [
          "#miniscore-branding-container .text-cbPreview",
          "#miniscore-branding-container .text-cbTxtLive",
          "#miniscore-branding-container .text-cbLive",
          ".text-cbPreview",
          ".text-cbTxtLive",
          ".text-cbLive",
          ".cb-text-complete",
          ".cb-text-live",
          ".cb-text-stump",
          ".cb-text-lunch",
          ".cb-text-tea",
          ".cb-text-preview",
          "#miniscore-branding-container .text-cbTextLink",
          '[id^="sticky-m"] .text-cbTextLink',
          ".text-cbTextLink",
          ".cb-scrcrd-status",
          ".cb-min-stts"
        ]
      },
      venue: {
        selectors: ["a[href*='/venues/']", ".cb-nav-subhdr", "span[itemprop='location']", ".cb-mtch-info-itm"]
      },
      toss: {
        selectors: [
          ".cb-text-toss",
          ".cb-toss",
          ".text-cbItmBkgDark div",
          ".text-sm.text-cbTxtSec",
          "#miniscore-branding-container .text-cbPreview",
          ".text-cbPreview"
        ],
        regex: "(?:.*?[Tt]oss:\\s*)?([^\\n\\r]+)"
      },
      team1: {
        selectors: [
          '#miniscore-branding-container [class*="flex-row"]:first-child .mr-2',
          '[id^="sticky-m"] [class*="flex-row"]:first-child .mr-2',
          "#miniscore-branding-container .text-base .mr-2",
          '#miniscore-branding-container [class*="flex-row"]:first-child > div:first-child',
          ".cb-hm-rwt .cb-hm-rwt-title",
          ".cb-col-50.cb-font-16"
        ]
      },
      team2: {
        selectors: [
          "#miniscore-branding-container .text-xl .mr-2",
          '#miniscore-branding-container [class*="flex-row"]:nth-child(2) .mr-2',
          '[id^="sticky-m"] [class*="flex-row"]:nth-child(2) .mr-2',
          '#miniscore-branding-container [class*="flex-row"]:nth-child(2) > div:first-child',
          ".cb-hm-rwt .cb-hm-rwt-title:nth-child(2)",
          ".cb-col-50.cb-font-16:nth-child(2)"
        ]
      },
      battingTeam: {
        selectors: [
          "#miniscore-branding-container .text-xl .mr-2",
          "#sticky-mscore .font-bold.text-lg",
          "#miniscore-branding-container .text-xl > div:first-child",
          '#miniscore-branding-container [class*="flex-row"]:last-child .mr-2',
          '[id^="sticky-m"] [class*="flex-row"]:last-child .mr-2'
        ]
      },
      "inn1.team": {
        selectors: [
          "#miniscore-branding-container .text-base .mr-2",
          '#miniscore-branding-container [class*="flex-row"]:first-child:not(:last-child) .mr-2',
          '[id^="sticky-m"] [class*="flex-row"]:first-child:not(:last-child) .mr-2'
        ]
      },
      "inn1.score": {
        selectors: [
          "#miniscore-branding-container .text-base span.mr-2:first-child",
          "#miniscore-branding-container .text-base > div:last-child",
          "#miniscore-branding-container .text-base .flex",
          '#miniscore-branding-container [class*="flex-row"]:first-child:not(:last-child) .flex',
          '#miniscore-branding-container [class*="flex-row"]:first-child:not(:last-child) div:last-child',
          '[id^="sticky-m"] [class*="flex-row"]:first-child:not(:last-child) div:last-child'
        ]
      },
      "inn1.overs": {
        selectors: [
          "#miniscore-branding-container .text-base span.mr-2:last-child",
          "#miniscore-branding-container .text-base span:last-child",
          "#miniscore-branding-container .text-base span.ml-1",
          "#miniscore-branding-container .text-base > div:nth-child(2) > div",
          '#miniscore-branding-container [class*="flex-row"]:first-child:not(:last-child) span.ml-1',
          '[id^="sticky-m"] [class*="flex-row"]:first-child:not(:last-child) span.ml-1'
        ],
        regex: "(?:\\(|\\s)?(\\d{1,3}(?:\\.\\d)?)(?:\\)|\\s|Ovs)?"
      },
      "inn2.team": {
        selectors: [
          "#miniscore-branding-container .text-xl > div:first-child",
          "#miniscore-branding-container .text-xl .mr-2",
          '#miniscore-branding-container [class*="flex-row"]:nth-child(2) .mr-2',
          '[id^="sticky-m"] [class*="flex-row"]:nth-child(2) .mr-2'
        ]
      },
      "inn2.score": {
        selectors: [
          "#miniscore-branding-container .text-xl span.mr-2:first-child",
          '#miniscore-branding-container [class*="flex-row"]:nth-child(2) .text-xl span.mr-2:first-child',
          '#miniscore-branding-container [class*="flex-row"]:nth-child(2) .text-xl > div:nth-child(2)',
          '#miniscore-branding-container [class*="flex-row"]:nth-child(2) .flex',
          '#miniscore-branding-container [class*="flex-row"]:nth-child(2) div:last-child',
          '[id^="sticky-m"] [class*="flex-row"]:nth-child(2) .text-3xl',
          '[id^="sticky-m"] [class*="flex-row"]:nth-child(2) div:last-child',
          "#miniscore-branding-container .text-xl > div:nth-child(2)"
        ]
      },
      "inn2.overs": {
        selectors: [
          "#miniscore-branding-container .text-xl span.mr-2:last-child",
          "#miniscore-branding-container .text-xl span:last-child",
          "#sticky-mscore .text-cbTxtSec",
          '#miniscore-branding-container [class*="flex-row"]:nth-child(2) .text-xl span.mr-2:last-child',
          '#miniscore-branding-container [class*="flex-row"]:nth-child(2) .text-xl > div:nth-child(2) > div',
          '#miniscore-branding-container [class*="flex-row"]:nth-child(2) .font-bold.text-lg',
          '#miniscore-branding-container [class*="flex-row"]:nth-child(2) .ml-1:not(.text-cbTxtSec)',
          '[id^="sticky-m"] [class*="flex-row"]:nth-child(2) .text-cbTxtSec',
          '#miniscore-branding-container [class*="flex-row"]:nth-child(2) span.ml-1',
          '[id^="sticky-m"] [class*="flex-row"]:nth-child(2) span.ml-1'
        ],
        regex: "(?:\\(|\\s)?(\\d{1,3}(?:\\.\\d)?)(?:\\)|\\s|Ovs)?"
      },
      score: {
        selectors: [
          "#miniscore-branding-container .text-xl span.mr-2:first-child",
          "#miniscore-branding-container .text-xl > div:nth-child(2) > span:first-child",
          "#miniscore-branding-container .text-xl > div:nth-child(2)",
          "#miniscore-branding-container .text-xl > .flex",
          "#miniscore-branding-container .text-xl .flex:has(span)",
          "#sticky-mscore .text-3xl",
          '#miniscore-branding-container [class*="flex-row"]:last-child div:nth-child(2)',
          ".cb-min-bat-rw .cb-font-20.text-bold",
          ".cb-min-bat-rw .cb-font-20",
          ".cb-min-bat-rw span",
          "h2.cb-font-20.text-bold",
          ".cb-col-100.cb-min-bat-rw",
          ".cb-col-67.cb-col-rt"
        ]
      },
      overs: {
        selectors: [
          "#miniscore-branding-container .text-xl span.mr-2:last-child",
          "#miniscore-branding-container .text-xl span:last-child",
          "#sticky-mscore .text-cbTxtSec",
          "#sticky-mscore .text-3xl .text-cbTxtSec",
          "#miniscore-branding-container .text-xl .text-cbTxtSec",
          "#miniscore-branding-container .text-xl > div:nth-child(2) > span:nth-child(2)",
          "#miniscore-branding-container .text-xl > div:nth-child(2) > div",
          "#miniscore-branding-container .text-xl .font-bold.text-lg",
          '#miniscore-branding-container [class*="flex-row"]:last-child span.ml-1',
          "#miniscore-branding-container span.ml-1",
          ".cb-min-bat-rw span:last-child",
          ".cb-min-bat-rw span.cb-font-14",
          ".cb-min-bat-rw span.cb-font-12",
          ".cb-font-14",
          ".cb-font-12"
        ],
        regex: "(?:\\(|\\s)?(\\d{1,3}(?:\\.\\d)?)(?:\\)|\\s|Ovs)?"
      },
      "batter1.name": {
        selectors: [
          ".text-sm.mb-2 > div:nth-child(2) span.hover\\:underline",
          ".scorecard-bat-grid:has(a[href*='/batting']):first-of-type span.hover\\:underline",
          ".cb-min-inf .cb-col-100:nth-child(1) .cb-col-50 a",
          ".cb-min-inf .cb-col-50 a",
          ".cb-min-inf div:first-child a"
        ]
      },
      "batter1.runs": {
        selectors: [
          ".text-sm.mb-2 > div:nth-child(2) > div:nth-child(2)",
          ".scorecard-bat-grid:has(a[href*='/batting']):first-of-type > div:nth-child(2)",
          ".cb-min-inf .cb-col-100:nth-child(1) .cb-col-10:nth-of-type(2)",
          ".cb-min-inf div:first-child .cb-col-10:nth-of-type(2)"
        ]
      },
      "batter1.balls": {
        selectors: [
          ".text-sm.mb-2 > div:nth-child(2) > div:nth-child(3)",
          ".scorecard-bat-grid:has(a[href*='/batting']):first-of-type > div:nth-child(3)",
          ".cb-min-inf .cb-col-100:nth-child(1) .cb-col-10:nth-of-type(3)",
          ".cb-min-inf div:first-child .cb-col-10:nth-of-type(3)"
        ]
      },
      "batter1.fours": {
        selectors: [
          ".text-sm.mb-2 > div:nth-child(2) > div:nth-child(4)",
          ".scorecard-bat-grid:has(a[href*='/batting']):first-of-type > div:nth-child(4)",
          ".cb-min-inf .cb-col-100:nth-child(1) .cb-col-10:nth-of-type(4)",
          ".cb-min-inf div:first-child .cb-col-10:nth-of-type(4)"
        ]
      },
      "batter1.sixes": {
        selectors: [
          ".text-sm.mb-2 > div:nth-child(2) > div:nth-child(5)",
          ".scorecard-bat-grid:has(a[href*='/batting']):first-of-type > div:nth-child(5)",
          ".cb-min-inf .cb-col-100:nth-child(1) .cb-col-10:nth-of-type(5)",
          ".cb-min-inf div:first-child .cb-col-10:nth-of-type(5)"
        ]
      },
      "batter2.name": {
        selectors: [
          ".text-sm.mb-2 > div:nth-child(3) span.hover\\:underline",
          ".scorecard-bat-grid:has(a[href*='/batting']):nth-of-type(2) span.hover\\:underline",
          ".cb-min-inf .cb-col-100:nth-child(2) .cb-col-50 a",
          ".cb-min-inf div:nth-child(2) a"
        ]
      },
      "batter2.runs": {
        selectors: [
          ".text-sm.mb-2 > div:nth-child(3) > div:nth-child(2)",
          ".scorecard-bat-grid:has(a[href*='/batting']):nth-of-type(2) > div:nth-child(2)",
          ".cb-min-inf .cb-col-100:nth-child(2) .cb-col-10:nth-of-type(2)",
          ".cb-min-inf div:nth-child(2) .cb-col-10:nth-of-type(2)"
        ]
      },
      "batter2.balls": {
        selectors: [
          ".text-sm.mb-2 > div:nth-child(3) > div:nth-child(3)",
          ".scorecard-bat-grid:has(a[href*='/batting']):nth-of-type(2) > div:nth-child(3)",
          ".cb-min-inf .cb-col-100:nth-child(2) .cb-col-10:nth-of-type(3)",
          ".cb-min-inf div:nth-child(2) .cb-col-10:nth-of-type(3)"
        ]
      },
      "batter2.fours": {
        selectors: [
          ".text-sm.mb-2 > div:nth-child(3) > div:nth-child(4)",
          ".scorecard-bat-grid:has(a[href*='/batting']):nth-of-type(2) > div:nth-child(4)",
          ".cb-min-inf .cb-col-100:nth-child(2) .cb-col-10:nth-of-type(4)",
          ".cb-min-inf div:nth-child(2) .cb-col-10:nth-of-type(4)"
        ]
      },
      "batter2.sixes": {
        selectors: [
          ".text-sm.mb-2 > div:nth-child(3) > div:nth-child(5)",
          ".scorecard-bat-grid:has(a[href*='/batting']):nth-of-type(2) > div:nth-child(5)",
          ".cb-min-inf .cb-col-100:nth-child(2) .cb-col-10:nth-of-type(5)",
          ".cb-min-inf div:nth-child(2) .cb-col-10:nth-of-type(5)"
        ]
      },
      "bowler.name": {
        selectors: [
          ".scorecard-bat-grid:has(a[href*='/bowling']) span.hover\\:underline",
          ".cb-min-inf .cb-col-100:last-child .cb-col-40 a",
          ".cb-min-inf .cb-col-50 a:last-child",
          ".cb-min-inf div:last-child a"
        ]
      },
      "bowler.overs": {
        selectors: [
          ".scorecard-bat-grid:has(a[href*='/bowling']) > div:nth-child(2)",
          ".cb-min-inf .cb-col-100:last-child .cb-col-10:nth-of-type(2)",
          ".cb-min-inf div:last-child .cb-col-10:nth-of-type(2)"
        ]
      },
      "bowler.maidens": {
        selectors: [
          ".scorecard-bat-grid:has(a[href*='/bowling']) > div:nth-child(3)",
          ".cb-min-inf .cb-col-100:last-child .cb-col-10:nth-of-type(3)",
          ".cb-min-inf div:last-child .cb-col-10:nth-of-type(3)"
        ]
      },
      "bowler.runs": {
        selectors: [
          ".scorecard-bat-grid:has(a[href*='/bowling']) > div:nth-child(4)",
          ".cb-min-inf .cb-col-100:last-child .cb-col-10:nth-of-type(4)",
          ".cb-min-inf div:last-child .cb-col-10:nth-of-type(4)"
        ]
      },
      "bowler.wkts": {
        selectors: [
          ".scorecard-bat-grid:has(a[href*='/bowling']) > div:nth-child(5)",
          ".cb-min-inf .cb-col-100:last-child .cb-col-10:nth-of-type(5)",
          ".cb-min-inf div:last-child .cb-col-10:nth-of-type(5)"
        ]
      },
      thisOver: {
        selectors: [".cb-min-rec", "span.cb-min-rec", "div.cb-min-rec"]
      },
      lastBalls: {
        selectors: ["p.text-\\[\\#666\\]", ".text-\\[\\#666\\]"],
        label: "Recent"
      },
      partnership: {
        selectors: [
          ".text-cbItmBkgDark div",
          ".text-sm.text-cbTxtSec",
          ".cb-col-100:has(.cb-min-itm)",
          ".cb-font-12"
        ],
        regex: "(?:Partnership:?\\s*)(\\d+\\s*(?:\\(\\s*\\d+\\s*\\))?)"
      },
      crr: {
        selectors: [
          "#miniscore-branding-container .text-cbTxtSec.ml-1",
          "#miniscore-branding-container .inline-block"
        ],
        regex: "(?:CRR|Current Rate)[:\\s]*([\\d.]+)"
      },
      rrr: {
        selectors: [
          ".text-cbTxtSec",
          "#miniscore-branding-container .text-cbTxtSec"
        ],
        regex: "(?:REQ|RRR):?\\s*([\\d.]+)"
      },
      target: {
        selectors: [
          ".text-cbTxtSec",
          "#miniscore-branding-container .text-cbTxtSec"
        ],
        regex: "(?:Target|TAR):?\\s*(\\d+)"
      }
    },
    minConfidenceFields: ["score", "overs"]
  };

  // ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/external.js
  var external_exports = {};
  __export(external_exports, {
    BRAND: () => BRAND,
    DIRTY: () => DIRTY,
    EMPTY_PATH: () => EMPTY_PATH,
    INVALID: () => INVALID,
    NEVER: () => NEVER,
    OK: () => OK,
    ParseStatus: () => ParseStatus,
    Schema: () => ZodType,
    ZodAny: () => ZodAny,
    ZodArray: () => ZodArray,
    ZodBigInt: () => ZodBigInt,
    ZodBoolean: () => ZodBoolean,
    ZodBranded: () => ZodBranded,
    ZodCatch: () => ZodCatch,
    ZodDate: () => ZodDate,
    ZodDefault: () => ZodDefault,
    ZodDiscriminatedUnion: () => ZodDiscriminatedUnion,
    ZodEffects: () => ZodEffects,
    ZodEnum: () => ZodEnum,
    ZodError: () => ZodError,
    ZodFirstPartyTypeKind: () => ZodFirstPartyTypeKind,
    ZodFunction: () => ZodFunction,
    ZodIntersection: () => ZodIntersection,
    ZodIssueCode: () => ZodIssueCode,
    ZodLazy: () => ZodLazy,
    ZodLiteral: () => ZodLiteral,
    ZodMap: () => ZodMap,
    ZodNaN: () => ZodNaN,
    ZodNativeEnum: () => ZodNativeEnum,
    ZodNever: () => ZodNever,
    ZodNull: () => ZodNull,
    ZodNullable: () => ZodNullable,
    ZodNumber: () => ZodNumber,
    ZodObject: () => ZodObject,
    ZodOptional: () => ZodOptional,
    ZodParsedType: () => ZodParsedType,
    ZodPipeline: () => ZodPipeline,
    ZodPromise: () => ZodPromise,
    ZodReadonly: () => ZodReadonly,
    ZodRecord: () => ZodRecord,
    ZodSchema: () => ZodType,
    ZodSet: () => ZodSet,
    ZodString: () => ZodString,
    ZodSymbol: () => ZodSymbol,
    ZodTransformer: () => ZodEffects,
    ZodTuple: () => ZodTuple,
    ZodType: () => ZodType,
    ZodUndefined: () => ZodUndefined,
    ZodUnion: () => ZodUnion,
    ZodUnknown: () => ZodUnknown,
    ZodVoid: () => ZodVoid,
    addIssueToContext: () => addIssueToContext,
    any: () => anyType,
    array: () => arrayType,
    bigint: () => bigIntType,
    boolean: () => booleanType,
    coerce: () => coerce,
    custom: () => custom,
    date: () => dateType,
    datetimeRegex: () => datetimeRegex,
    defaultErrorMap: () => en_default,
    discriminatedUnion: () => discriminatedUnionType,
    effect: () => effectsType,
    enum: () => enumType,
    function: () => functionType,
    getErrorMap: () => getErrorMap,
    getParsedType: () => getParsedType,
    instanceof: () => instanceOfType,
    intersection: () => intersectionType,
    isAborted: () => isAborted,
    isAsync: () => isAsync,
    isDirty: () => isDirty,
    isValid: () => isValid,
    late: () => late,
    lazy: () => lazyType,
    literal: () => literalType,
    makeIssue: () => makeIssue,
    map: () => mapType,
    nan: () => nanType,
    nativeEnum: () => nativeEnumType,
    never: () => neverType,
    null: () => nullType,
    nullable: () => nullableType,
    number: () => numberType,
    object: () => objectType,
    objectUtil: () => objectUtil,
    oboolean: () => oboolean,
    onumber: () => onumber,
    optional: () => optionalType,
    ostring: () => ostring,
    pipeline: () => pipelineType,
    preprocess: () => preprocessType,
    promise: () => promiseType,
    quotelessJson: () => quotelessJson,
    record: () => recordType,
    set: () => setType,
    setErrorMap: () => setErrorMap,
    strictObject: () => strictObjectType,
    string: () => stringType,
    symbol: () => symbolType,
    transformer: () => effectsType,
    tuple: () => tupleType,
    undefined: () => undefinedType,
    union: () => unionType,
    unknown: () => unknownType,
    util: () => util,
    void: () => voidType
  });

  // ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/util.js
  var util;
  (function(util2) {
    util2.assertEqual = (_) => {
    };
    function assertIs(_arg) {
    }
    util2.assertIs = assertIs;
    function assertNever(_x) {
      throw new Error();
    }
    util2.assertNever = assertNever;
    util2.arrayToEnum = (items) => {
      const obj = {};
      for (const item of items) {
        obj[item] = item;
      }
      return obj;
    };
    util2.getValidEnumValues = (obj) => {
      const validKeys = util2.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
      const filtered = {};
      for (const k of validKeys) {
        filtered[k] = obj[k];
      }
      return util2.objectValues(filtered);
    };
    util2.objectValues = (obj) => {
      return util2.objectKeys(obj).map(function(e) {
        return obj[e];
      });
    };
    util2.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
      const keys = [];
      for (const key in object) {
        if (Object.prototype.hasOwnProperty.call(object, key)) {
          keys.push(key);
        }
      }
      return keys;
    };
    util2.find = (arr, checker) => {
      for (const item of arr) {
        if (checker(item))
          return item;
      }
      return void 0;
    };
    util2.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && Number.isFinite(val) && Math.floor(val) === val;
    function joinValues(array, separator = " | ") {
      return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
    }
    util2.joinValues = joinValues;
    util2.jsonStringifyReplacer = (_, value) => {
      if (typeof value === "bigint") {
        return value.toString();
      }
      return value;
    };
  })(util || (util = {}));
  var objectUtil;
  (function(objectUtil2) {
    objectUtil2.mergeShapes = (first, second) => {
      return {
        ...first,
        ...second
        // second overwrites first
      };
    };
  })(objectUtil || (objectUtil = {}));
  var ZodParsedType = util.arrayToEnum([
    "string",
    "nan",
    "number",
    "integer",
    "float",
    "boolean",
    "date",
    "bigint",
    "symbol",
    "function",
    "undefined",
    "null",
    "array",
    "object",
    "unknown",
    "promise",
    "void",
    "never",
    "map",
    "set"
  ]);
  var getParsedType = (data) => {
    const t = typeof data;
    switch (t) {
      case "undefined":
        return ZodParsedType.undefined;
      case "string":
        return ZodParsedType.string;
      case "number":
        return Number.isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
      case "boolean":
        return ZodParsedType.boolean;
      case "function":
        return ZodParsedType.function;
      case "bigint":
        return ZodParsedType.bigint;
      case "symbol":
        return ZodParsedType.symbol;
      case "object":
        if (Array.isArray(data)) {
          return ZodParsedType.array;
        }
        if (data === null) {
          return ZodParsedType.null;
        }
        if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
          return ZodParsedType.promise;
        }
        if (typeof Map !== "undefined" && data instanceof Map) {
          return ZodParsedType.map;
        }
        if (typeof Set !== "undefined" && data instanceof Set) {
          return ZodParsedType.set;
        }
        if (typeof Date !== "undefined" && data instanceof Date) {
          return ZodParsedType.date;
        }
        return ZodParsedType.object;
      default:
        return ZodParsedType.unknown;
    }
  };

  // ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/ZodError.js
  var ZodIssueCode = util.arrayToEnum([
    "invalid_type",
    "invalid_literal",
    "custom",
    "invalid_union",
    "invalid_union_discriminator",
    "invalid_enum_value",
    "unrecognized_keys",
    "invalid_arguments",
    "invalid_return_type",
    "invalid_date",
    "invalid_string",
    "too_small",
    "too_big",
    "invalid_intersection_types",
    "not_multiple_of",
    "not_finite"
  ]);
  var quotelessJson = (obj) => {
    const json = JSON.stringify(obj, null, 2);
    return json.replace(/"([^"]+)":/g, "$1:");
  };
  var ZodError = class _ZodError extends Error {
    get errors() {
      return this.issues;
    }
    constructor(issues) {
      super();
      this.issues = [];
      this.addIssue = (sub) => {
        this.issues = [...this.issues, sub];
      };
      this.addIssues = (subs = []) => {
        this.issues = [...this.issues, ...subs];
      };
      const actualProto = new.target.prototype;
      if (Object.setPrototypeOf) {
        Object.setPrototypeOf(this, actualProto);
      } else {
        this.__proto__ = actualProto;
      }
      this.name = "ZodError";
      this.issues = issues;
    }
    format(_mapper) {
      const mapper = _mapper || function(issue) {
        return issue.message;
      };
      const fieldErrors = { _errors: [] };
      const processError = (error) => {
        for (const issue of error.issues) {
          if (issue.code === "invalid_union") {
            issue.unionErrors.map(processError);
          } else if (issue.code === "invalid_return_type") {
            processError(issue.returnTypeError);
          } else if (issue.code === "invalid_arguments") {
            processError(issue.argumentsError);
          } else if (issue.path.length === 0) {
            fieldErrors._errors.push(mapper(issue));
          } else {
            let curr = fieldErrors;
            let i = 0;
            while (i < issue.path.length) {
              const el = issue.path[i];
              const terminal = i === issue.path.length - 1;
              if (!terminal) {
                curr[el] = curr[el] || { _errors: [] };
              } else {
                curr[el] = curr[el] || { _errors: [] };
                curr[el]._errors.push(mapper(issue));
              }
              curr = curr[el];
              i++;
            }
          }
        }
      };
      processError(this);
      return fieldErrors;
    }
    static assert(value) {
      if (!(value instanceof _ZodError)) {
        throw new Error(`Not a ZodError: ${value}`);
      }
    }
    toString() {
      return this.message;
    }
    get message() {
      return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
    }
    get isEmpty() {
      return this.issues.length === 0;
    }
    flatten(mapper = (issue) => issue.message) {
      const fieldErrors = {};
      const formErrors = [];
      for (const sub of this.issues) {
        if (sub.path.length > 0) {
          const firstEl = sub.path[0];
          fieldErrors[firstEl] = fieldErrors[firstEl] || [];
          fieldErrors[firstEl].push(mapper(sub));
        } else {
          formErrors.push(mapper(sub));
        }
      }
      return { formErrors, fieldErrors };
    }
    get formErrors() {
      return this.flatten();
    }
  };
  ZodError.create = (issues) => {
    const error = new ZodError(issues);
    return error;
  };

  // ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/locales/en.js
  var errorMap = (issue, _ctx) => {
    let message;
    switch (issue.code) {
      case ZodIssueCode.invalid_type:
        if (issue.received === ZodParsedType.undefined) {
          message = "Required";
        } else {
          message = `Expected ${issue.expected}, received ${issue.received}`;
        }
        break;
      case ZodIssueCode.invalid_literal:
        message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
        break;
      case ZodIssueCode.unrecognized_keys:
        message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
        break;
      case ZodIssueCode.invalid_union:
        message = `Invalid input`;
        break;
      case ZodIssueCode.invalid_union_discriminator:
        message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
        break;
      case ZodIssueCode.invalid_enum_value:
        message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
        break;
      case ZodIssueCode.invalid_arguments:
        message = `Invalid function arguments`;
        break;
      case ZodIssueCode.invalid_return_type:
        message = `Invalid function return type`;
        break;
      case ZodIssueCode.invalid_date:
        message = `Invalid date`;
        break;
      case ZodIssueCode.invalid_string:
        if (typeof issue.validation === "object") {
          if ("includes" in issue.validation) {
            message = `Invalid input: must include "${issue.validation.includes}"`;
            if (typeof issue.validation.position === "number") {
              message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
            }
          } else if ("startsWith" in issue.validation) {
            message = `Invalid input: must start with "${issue.validation.startsWith}"`;
          } else if ("endsWith" in issue.validation) {
            message = `Invalid input: must end with "${issue.validation.endsWith}"`;
          } else {
            util.assertNever(issue.validation);
          }
        } else if (issue.validation !== "regex") {
          message = `Invalid ${issue.validation}`;
        } else {
          message = "Invalid";
        }
        break;
      case ZodIssueCode.too_small:
        if (issue.type === "array")
          message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
        else if (issue.type === "string")
          message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
        else if (issue.type === "number")
          message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
        else if (issue.type === "bigint")
          message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
        else if (issue.type === "date")
          message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
        else
          message = "Invalid input";
        break;
      case ZodIssueCode.too_big:
        if (issue.type === "array")
          message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
        else if (issue.type === "string")
          message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
        else if (issue.type === "number")
          message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
        else if (issue.type === "bigint")
          message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
        else if (issue.type === "date")
          message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
        else
          message = "Invalid input";
        break;
      case ZodIssueCode.custom:
        message = `Invalid input`;
        break;
      case ZodIssueCode.invalid_intersection_types:
        message = `Intersection results could not be merged`;
        break;
      case ZodIssueCode.not_multiple_of:
        message = `Number must be a multiple of ${issue.multipleOf}`;
        break;
      case ZodIssueCode.not_finite:
        message = "Number must be finite";
        break;
      default:
        message = _ctx.defaultError;
        util.assertNever(issue);
    }
    return { message };
  };
  var en_default = errorMap;

  // ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/errors.js
  var overrideErrorMap = en_default;
  function setErrorMap(map) {
    overrideErrorMap = map;
  }
  function getErrorMap() {
    return overrideErrorMap;
  }

  // ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/parseUtil.js
  var makeIssue = (params) => {
    const { data, path, errorMaps, issueData } = params;
    const fullPath = [...path, ...issueData.path || []];
    const fullIssue = {
      ...issueData,
      path: fullPath
    };
    if (issueData.message !== void 0) {
      return {
        ...issueData,
        path: fullPath,
        message: issueData.message
      };
    }
    let errorMessage = "";
    const maps = errorMaps.filter((m) => !!m).slice().reverse();
    for (const map of maps) {
      errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
    }
    return {
      ...issueData,
      path: fullPath,
      message: errorMessage
    };
  };
  var EMPTY_PATH = [];
  function addIssueToContext(ctx, issueData) {
    const overrideMap = getErrorMap();
    const issue = makeIssue({
      issueData,
      data: ctx.data,
      path: ctx.path,
      errorMaps: [
        ctx.common.contextualErrorMap,
        // contextual error map is first priority
        ctx.schemaErrorMap,
        // then schema-bound map if available
        overrideMap,
        // then global override map
        overrideMap === en_default ? void 0 : en_default
        // then global default map
      ].filter((x) => !!x)
    });
    ctx.common.issues.push(issue);
  }
  var ParseStatus = class _ParseStatus {
    constructor() {
      this.value = "valid";
    }
    dirty() {
      if (this.value === "valid")
        this.value = "dirty";
    }
    abort() {
      if (this.value !== "aborted")
        this.value = "aborted";
    }
    static mergeArray(status, results) {
      const arrayValue = [];
      for (const s of results) {
        if (s.status === "aborted")
          return INVALID;
        if (s.status === "dirty")
          status.dirty();
        arrayValue.push(s.value);
      }
      return { status: status.value, value: arrayValue };
    }
    static async mergeObjectAsync(status, pairs) {
      const syncPairs = [];
      for (const pair of pairs) {
        const key = await pair.key;
        const value = await pair.value;
        syncPairs.push({
          key,
          value
        });
      }
      return _ParseStatus.mergeObjectSync(status, syncPairs);
    }
    static mergeObjectSync(status, pairs) {
      const finalObject = {};
      for (const pair of pairs) {
        const { key, value } = pair;
        if (key.status === "aborted")
          return INVALID;
        if (value.status === "aborted")
          return INVALID;
        if (key.status === "dirty")
          status.dirty();
        if (value.status === "dirty")
          status.dirty();
        if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
          finalObject[key.value] = value.value;
        }
      }
      return { status: status.value, value: finalObject };
    }
  };
  var INVALID = Object.freeze({
    status: "aborted"
  });
  var DIRTY = (value) => ({ status: "dirty", value });
  var OK = (value) => ({ status: "valid", value });
  var isAborted = (x) => x.status === "aborted";
  var isDirty = (x) => x.status === "dirty";
  var isValid = (x) => x.status === "valid";
  var isAsync = (x) => typeof Promise !== "undefined" && x instanceof Promise;

  // ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/errorUtil.js
  var errorUtil;
  (function(errorUtil2) {
    errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
    errorUtil2.toString = (message) => typeof message === "string" ? message : message?.message;
  })(errorUtil || (errorUtil = {}));

  // ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/types.js
  var ParseInputLazyPath = class {
    constructor(parent, value, path, key) {
      this._cachedPath = [];
      this.parent = parent;
      this.data = value;
      this._path = path;
      this._key = key;
    }
    get path() {
      if (!this._cachedPath.length) {
        if (Array.isArray(this._key)) {
          this._cachedPath.push(...this._path, ...this._key);
        } else {
          this._cachedPath.push(...this._path, this._key);
        }
      }
      return this._cachedPath;
    }
  };
  var handleResult = (ctx, result) => {
    if (isValid(result)) {
      return { success: true, data: result.value };
    } else {
      if (!ctx.common.issues.length) {
        throw new Error("Validation failed but no issues detected.");
      }
      return {
        success: false,
        get error() {
          if (this._error)
            return this._error;
          const error = new ZodError(ctx.common.issues);
          this._error = error;
          return this._error;
        }
      };
    }
  };
  function processCreateParams(params) {
    if (!params)
      return {};
    const { errorMap: errorMap2, invalid_type_error, required_error, description } = params;
    if (errorMap2 && (invalid_type_error || required_error)) {
      throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
    }
    if (errorMap2)
      return { errorMap: errorMap2, description };
    const customMap = (iss, ctx) => {
      const { message } = params;
      if (iss.code === "invalid_enum_value") {
        return { message: message ?? ctx.defaultError };
      }
      if (typeof ctx.data === "undefined") {
        return { message: message ?? required_error ?? ctx.defaultError };
      }
      if (iss.code !== "invalid_type")
        return { message: ctx.defaultError };
      return { message: message ?? invalid_type_error ?? ctx.defaultError };
    };
    return { errorMap: customMap, description };
  }
  var ZodType = class {
    get description() {
      return this._def.description;
    }
    _getType(input) {
      return getParsedType(input.data);
    }
    _getOrReturnCtx(input, ctx) {
      return ctx || {
        common: input.parent.common,
        data: input.data,
        parsedType: getParsedType(input.data),
        schemaErrorMap: this._def.errorMap,
        path: input.path,
        parent: input.parent
      };
    }
    _processInputParams(input) {
      return {
        status: new ParseStatus(),
        ctx: {
          common: input.parent.common,
          data: input.data,
          parsedType: getParsedType(input.data),
          schemaErrorMap: this._def.errorMap,
          path: input.path,
          parent: input.parent
        }
      };
    }
    _parseSync(input) {
      const result = this._parse(input);
      if (isAsync(result)) {
        throw new Error("Synchronous parse encountered promise.");
      }
      return result;
    }
    _parseAsync(input) {
      const result = this._parse(input);
      return Promise.resolve(result);
    }
    parse(data, params) {
      const result = this.safeParse(data, params);
      if (result.success)
        return result.data;
      throw result.error;
    }
    safeParse(data, params) {
      const ctx = {
        common: {
          issues: [],
          async: params?.async ?? false,
          contextualErrorMap: params?.errorMap
        },
        path: params?.path || [],
        schemaErrorMap: this._def.errorMap,
        parent: null,
        data,
        parsedType: getParsedType(data)
      };
      const result = this._parseSync({ data, path: ctx.path, parent: ctx });
      return handleResult(ctx, result);
    }
    "~validate"(data) {
      const ctx = {
        common: {
          issues: [],
          async: !!this["~standard"].async
        },
        path: [],
        schemaErrorMap: this._def.errorMap,
        parent: null,
        data,
        parsedType: getParsedType(data)
      };
      if (!this["~standard"].async) {
        try {
          const result = this._parseSync({ data, path: [], parent: ctx });
          return isValid(result) ? {
            value: result.value
          } : {
            issues: ctx.common.issues
          };
        } catch (err) {
          if (err?.message?.toLowerCase()?.includes("encountered")) {
            this["~standard"].async = true;
          }
          ctx.common = {
            issues: [],
            async: true
          };
        }
      }
      return this._parseAsync({ data, path: [], parent: ctx }).then((result) => isValid(result) ? {
        value: result.value
      } : {
        issues: ctx.common.issues
      });
    }
    async parseAsync(data, params) {
      const result = await this.safeParseAsync(data, params);
      if (result.success)
        return result.data;
      throw result.error;
    }
    async safeParseAsync(data, params) {
      const ctx = {
        common: {
          issues: [],
          contextualErrorMap: params?.errorMap,
          async: true
        },
        path: params?.path || [],
        schemaErrorMap: this._def.errorMap,
        parent: null,
        data,
        parsedType: getParsedType(data)
      };
      const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
      const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
      return handleResult(ctx, result);
    }
    refine(check, message) {
      const getIssueProperties = (val) => {
        if (typeof message === "string" || typeof message === "undefined") {
          return { message };
        } else if (typeof message === "function") {
          return message(val);
        } else {
          return message;
        }
      };
      return this._refinement((val, ctx) => {
        const result = check(val);
        const setError = () => ctx.addIssue({
          code: ZodIssueCode.custom,
          ...getIssueProperties(val)
        });
        if (typeof Promise !== "undefined" && result instanceof Promise) {
          return result.then((data) => {
            if (!data) {
              setError();
              return false;
            } else {
              return true;
            }
          });
        }
        if (!result) {
          setError();
          return false;
        } else {
          return true;
        }
      });
    }
    refinement(check, refinementData) {
      return this._refinement((val, ctx) => {
        if (!check(val)) {
          ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
          return false;
        } else {
          return true;
        }
      });
    }
    _refinement(refinement) {
      return new ZodEffects({
        schema: this,
        typeName: ZodFirstPartyTypeKind.ZodEffects,
        effect: { type: "refinement", refinement }
      });
    }
    superRefine(refinement) {
      return this._refinement(refinement);
    }
    constructor(def) {
      this.spa = this.safeParseAsync;
      this._def = def;
      this.parse = this.parse.bind(this);
      this.safeParse = this.safeParse.bind(this);
      this.parseAsync = this.parseAsync.bind(this);
      this.safeParseAsync = this.safeParseAsync.bind(this);
      this.spa = this.spa.bind(this);
      this.refine = this.refine.bind(this);
      this.refinement = this.refinement.bind(this);
      this.superRefine = this.superRefine.bind(this);
      this.optional = this.optional.bind(this);
      this.nullable = this.nullable.bind(this);
      this.nullish = this.nullish.bind(this);
      this.array = this.array.bind(this);
      this.promise = this.promise.bind(this);
      this.or = this.or.bind(this);
      this.and = this.and.bind(this);
      this.transform = this.transform.bind(this);
      this.brand = this.brand.bind(this);
      this.default = this.default.bind(this);
      this.catch = this.catch.bind(this);
      this.describe = this.describe.bind(this);
      this.pipe = this.pipe.bind(this);
      this.readonly = this.readonly.bind(this);
      this.isNullable = this.isNullable.bind(this);
      this.isOptional = this.isOptional.bind(this);
      this["~standard"] = {
        version: 1,
        vendor: "zod",
        validate: (data) => this["~validate"](data)
      };
    }
    optional() {
      return ZodOptional.create(this, this._def);
    }
    nullable() {
      return ZodNullable.create(this, this._def);
    }
    nullish() {
      return this.nullable().optional();
    }
    array() {
      return ZodArray.create(this);
    }
    promise() {
      return ZodPromise.create(this, this._def);
    }
    or(option) {
      return ZodUnion.create([this, option], this._def);
    }
    and(incoming) {
      return ZodIntersection.create(this, incoming, this._def);
    }
    transform(transform) {
      return new ZodEffects({
        ...processCreateParams(this._def),
        schema: this,
        typeName: ZodFirstPartyTypeKind.ZodEffects,
        effect: { type: "transform", transform }
      });
    }
    default(def) {
      const defaultValueFunc = typeof def === "function" ? def : () => def;
      return new ZodDefault({
        ...processCreateParams(this._def),
        innerType: this,
        defaultValue: defaultValueFunc,
        typeName: ZodFirstPartyTypeKind.ZodDefault
      });
    }
    brand() {
      return new ZodBranded({
        typeName: ZodFirstPartyTypeKind.ZodBranded,
        type: this,
        ...processCreateParams(this._def)
      });
    }
    catch(def) {
      const catchValueFunc = typeof def === "function" ? def : () => def;
      return new ZodCatch({
        ...processCreateParams(this._def),
        innerType: this,
        catchValue: catchValueFunc,
        typeName: ZodFirstPartyTypeKind.ZodCatch
      });
    }
    describe(description) {
      const This = this.constructor;
      return new This({
        ...this._def,
        description
      });
    }
    pipe(target) {
      return ZodPipeline.create(this, target);
    }
    readonly() {
      return ZodReadonly.create(this);
    }
    isOptional() {
      return this.safeParse(void 0).success;
    }
    isNullable() {
      return this.safeParse(null).success;
    }
  };
  var cuidRegex = /^c[^\s-]{8,}$/i;
  var cuid2Regex = /^[0-9a-z]+$/;
  var ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
  var uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
  var nanoidRegex = /^[a-z0-9_-]{21}$/i;
  var jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
  var durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
  var emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
  var _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
  var emojiRegex;
  var ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
  var ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
  var ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
  var ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
  var base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
  var base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
  var dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
  var dateRegex = new RegExp(`^${dateRegexSource}$`);
  function timeRegexSource(args) {
    let secondsRegexSource = `[0-5]\\d`;
    if (args.precision) {
      secondsRegexSource = `${secondsRegexSource}\\.\\d{${args.precision}}`;
    } else if (args.precision == null) {
      secondsRegexSource = `${secondsRegexSource}(\\.\\d+)?`;
    }
    const secondsQuantifier = args.precision ? "+" : "?";
    return `([01]\\d|2[0-3]):[0-5]\\d(:${secondsRegexSource})${secondsQuantifier}`;
  }
  function timeRegex(args) {
    return new RegExp(`^${timeRegexSource(args)}$`);
  }
  function datetimeRegex(args) {
    let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
    const opts = [];
    opts.push(args.local ? `Z?` : `Z`);
    if (args.offset)
      opts.push(`([+-]\\d{2}:?\\d{2})`);
    regex = `${regex}(${opts.join("|")})`;
    return new RegExp(`^${regex}$`);
  }
  function isValidIP(ip, version) {
    if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
      return true;
    }
    if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
      return true;
    }
    return false;
  }
  function isValidJWT(jwt, alg) {
    if (!jwtRegex.test(jwt))
      return false;
    try {
      const [header] = jwt.split(".");
      if (!header)
        return false;
      const base64 = header.replace(/-/g, "+").replace(/_/g, "/").padEnd(header.length + (4 - header.length % 4) % 4, "=");
      const decoded = JSON.parse(atob(base64));
      if (typeof decoded !== "object" || decoded === null)
        return false;
      if ("typ" in decoded && decoded?.typ !== "JWT")
        return false;
      if (!decoded.alg)
        return false;
      if (alg && decoded.alg !== alg)
        return false;
      return true;
    } catch {
      return false;
    }
  }
  function isValidCidr(ip, version) {
    if ((version === "v4" || !version) && ipv4CidrRegex.test(ip)) {
      return true;
    }
    if ((version === "v6" || !version) && ipv6CidrRegex.test(ip)) {
      return true;
    }
    return false;
  }
  var ZodString = class _ZodString extends ZodType {
    _parse(input) {
      if (this._def.coerce) {
        input.data = String(input.data);
      }
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.string) {
        const ctx2 = this._getOrReturnCtx(input);
        addIssueToContext(ctx2, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.string,
          received: ctx2.parsedType
        });
        return INVALID;
      }
      const status = new ParseStatus();
      let ctx = void 0;
      for (const check of this._def.checks) {
        if (check.kind === "min") {
          if (input.data.length < check.value) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "string",
              inclusive: true,
              exact: false,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "max") {
          if (input.data.length > check.value) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "string",
              inclusive: true,
              exact: false,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "length") {
          const tooBig = input.data.length > check.value;
          const tooSmall = input.data.length < check.value;
          if (tooBig || tooSmall) {
            ctx = this._getOrReturnCtx(input, ctx);
            if (tooBig) {
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_big,
                maximum: check.value,
                type: "string",
                inclusive: true,
                exact: true,
                message: check.message
              });
            } else if (tooSmall) {
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_small,
                minimum: check.value,
                type: "string",
                inclusive: true,
                exact: true,
                message: check.message
              });
            }
            status.dirty();
          }
        } else if (check.kind === "email") {
          if (!emailRegex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "email",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "emoji") {
          if (!emojiRegex) {
            emojiRegex = new RegExp(_emojiRegex, "u");
          }
          if (!emojiRegex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "emoji",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "uuid") {
          if (!uuidRegex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "uuid",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "nanoid") {
          if (!nanoidRegex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "nanoid",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "cuid") {
          if (!cuidRegex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "cuid",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "cuid2") {
          if (!cuid2Regex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "cuid2",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "ulid") {
          if (!ulidRegex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "ulid",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "url") {
          try {
            new URL(input.data);
          } catch {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "url",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "regex") {
          check.regex.lastIndex = 0;
          const testResult = check.regex.test(input.data);
          if (!testResult) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "regex",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "trim") {
          input.data = input.data.trim();
        } else if (check.kind === "includes") {
          if (!input.data.includes(check.value, check.position)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_string,
              validation: { includes: check.value, position: check.position },
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "toLowerCase") {
          input.data = input.data.toLowerCase();
        } else if (check.kind === "toUpperCase") {
          input.data = input.data.toUpperCase();
        } else if (check.kind === "startsWith") {
          if (!input.data.startsWith(check.value)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_string,
              validation: { startsWith: check.value },
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "endsWith") {
          if (!input.data.endsWith(check.value)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_string,
              validation: { endsWith: check.value },
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "datetime") {
          const regex = datetimeRegex(check);
          if (!regex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_string,
              validation: "datetime",
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "date") {
          const regex = dateRegex;
          if (!regex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_string,
              validation: "date",
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "time") {
          const regex = timeRegex(check);
          if (!regex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_string,
              validation: "time",
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "duration") {
          if (!durationRegex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "duration",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "ip") {
          if (!isValidIP(input.data, check.version)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "ip",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "jwt") {
          if (!isValidJWT(input.data, check.alg)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "jwt",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "cidr") {
          if (!isValidCidr(input.data, check.version)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "cidr",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "base64") {
          if (!base64Regex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "base64",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "base64url") {
          if (!base64urlRegex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "base64url",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else {
          util.assertNever(check);
        }
      }
      return { status: status.value, value: input.data };
    }
    _regex(regex, validation, message) {
      return this.refinement((data) => regex.test(data), {
        validation,
        code: ZodIssueCode.invalid_string,
        ...errorUtil.errToObj(message)
      });
    }
    _addCheck(check) {
      return new _ZodString({
        ...this._def,
        checks: [...this._def.checks, check]
      });
    }
    email(message) {
      return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
    }
    url(message) {
      return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
    }
    emoji(message) {
      return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
    }
    uuid(message) {
      return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
    }
    nanoid(message) {
      return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
    }
    cuid(message) {
      return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
    }
    cuid2(message) {
      return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
    }
    ulid(message) {
      return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
    }
    base64(message) {
      return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
    }
    base64url(message) {
      return this._addCheck({
        kind: "base64url",
        ...errorUtil.errToObj(message)
      });
    }
    jwt(options) {
      return this._addCheck({ kind: "jwt", ...errorUtil.errToObj(options) });
    }
    ip(options) {
      return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
    }
    cidr(options) {
      return this._addCheck({ kind: "cidr", ...errorUtil.errToObj(options) });
    }
    datetime(options) {
      if (typeof options === "string") {
        return this._addCheck({
          kind: "datetime",
          precision: null,
          offset: false,
          local: false,
          message: options
        });
      }
      return this._addCheck({
        kind: "datetime",
        precision: typeof options?.precision === "undefined" ? null : options?.precision,
        offset: options?.offset ?? false,
        local: options?.local ?? false,
        ...errorUtil.errToObj(options?.message)
      });
    }
    date(message) {
      return this._addCheck({ kind: "date", message });
    }
    time(options) {
      if (typeof options === "string") {
        return this._addCheck({
          kind: "time",
          precision: null,
          message: options
        });
      }
      return this._addCheck({
        kind: "time",
        precision: typeof options?.precision === "undefined" ? null : options?.precision,
        ...errorUtil.errToObj(options?.message)
      });
    }
    duration(message) {
      return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
    }
    regex(regex, message) {
      return this._addCheck({
        kind: "regex",
        regex,
        ...errorUtil.errToObj(message)
      });
    }
    includes(value, options) {
      return this._addCheck({
        kind: "includes",
        value,
        position: options?.position,
        ...errorUtil.errToObj(options?.message)
      });
    }
    startsWith(value, message) {
      return this._addCheck({
        kind: "startsWith",
        value,
        ...errorUtil.errToObj(message)
      });
    }
    endsWith(value, message) {
      return this._addCheck({
        kind: "endsWith",
        value,
        ...errorUtil.errToObj(message)
      });
    }
    min(minLength, message) {
      return this._addCheck({
        kind: "min",
        value: minLength,
        ...errorUtil.errToObj(message)
      });
    }
    max(maxLength, message) {
      return this._addCheck({
        kind: "max",
        value: maxLength,
        ...errorUtil.errToObj(message)
      });
    }
    length(len, message) {
      return this._addCheck({
        kind: "length",
        value: len,
        ...errorUtil.errToObj(message)
      });
    }
    /**
     * Equivalent to `.min(1)`
     */
    nonempty(message) {
      return this.min(1, errorUtil.errToObj(message));
    }
    trim() {
      return new _ZodString({
        ...this._def,
        checks: [...this._def.checks, { kind: "trim" }]
      });
    }
    toLowerCase() {
      return new _ZodString({
        ...this._def,
        checks: [...this._def.checks, { kind: "toLowerCase" }]
      });
    }
    toUpperCase() {
      return new _ZodString({
        ...this._def,
        checks: [...this._def.checks, { kind: "toUpperCase" }]
      });
    }
    get isDatetime() {
      return !!this._def.checks.find((ch) => ch.kind === "datetime");
    }
    get isDate() {
      return !!this._def.checks.find((ch) => ch.kind === "date");
    }
    get isTime() {
      return !!this._def.checks.find((ch) => ch.kind === "time");
    }
    get isDuration() {
      return !!this._def.checks.find((ch) => ch.kind === "duration");
    }
    get isEmail() {
      return !!this._def.checks.find((ch) => ch.kind === "email");
    }
    get isURL() {
      return !!this._def.checks.find((ch) => ch.kind === "url");
    }
    get isEmoji() {
      return !!this._def.checks.find((ch) => ch.kind === "emoji");
    }
    get isUUID() {
      return !!this._def.checks.find((ch) => ch.kind === "uuid");
    }
    get isNANOID() {
      return !!this._def.checks.find((ch) => ch.kind === "nanoid");
    }
    get isCUID() {
      return !!this._def.checks.find((ch) => ch.kind === "cuid");
    }
    get isCUID2() {
      return !!this._def.checks.find((ch) => ch.kind === "cuid2");
    }
    get isULID() {
      return !!this._def.checks.find((ch) => ch.kind === "ulid");
    }
    get isIP() {
      return !!this._def.checks.find((ch) => ch.kind === "ip");
    }
    get isCIDR() {
      return !!this._def.checks.find((ch) => ch.kind === "cidr");
    }
    get isBase64() {
      return !!this._def.checks.find((ch) => ch.kind === "base64");
    }
    get isBase64url() {
      return !!this._def.checks.find((ch) => ch.kind === "base64url");
    }
    get minLength() {
      let min = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "min") {
          if (min === null || ch.value > min)
            min = ch.value;
        }
      }
      return min;
    }
    get maxLength() {
      let max = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "max") {
          if (max === null || ch.value < max)
            max = ch.value;
        }
      }
      return max;
    }
  };
  ZodString.create = (params) => {
    return new ZodString({
      checks: [],
      typeName: ZodFirstPartyTypeKind.ZodString,
      coerce: params?.coerce ?? false,
      ...processCreateParams(params)
    });
  };
  function floatSafeRemainder(val, step) {
    const valDecCount = (val.toString().split(".")[1] || "").length;
    const stepDecCount = (step.toString().split(".")[1] || "").length;
    const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
    const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
    const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
    return valInt % stepInt / 10 ** decCount;
  }
  var ZodNumber = class _ZodNumber extends ZodType {
    constructor() {
      super(...arguments);
      this.min = this.gte;
      this.max = this.lte;
      this.step = this.multipleOf;
    }
    _parse(input) {
      if (this._def.coerce) {
        input.data = Number(input.data);
      }
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.number) {
        const ctx2 = this._getOrReturnCtx(input);
        addIssueToContext(ctx2, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.number,
          received: ctx2.parsedType
        });
        return INVALID;
      }
      let ctx = void 0;
      const status = new ParseStatus();
      for (const check of this._def.checks) {
        if (check.kind === "int") {
          if (!util.isInteger(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_type,
              expected: "integer",
              received: "float",
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "min") {
          const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
          if (tooSmall) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "number",
              inclusive: check.inclusive,
              exact: false,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "max") {
          const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
          if (tooBig) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "number",
              inclusive: check.inclusive,
              exact: false,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "multipleOf") {
          if (floatSafeRemainder(input.data, check.value) !== 0) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.not_multiple_of,
              multipleOf: check.value,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "finite") {
          if (!Number.isFinite(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.not_finite,
              message: check.message
            });
            status.dirty();
          }
        } else {
          util.assertNever(check);
        }
      }
      return { status: status.value, value: input.data };
    }
    gte(value, message) {
      return this.setLimit("min", value, true, errorUtil.toString(message));
    }
    gt(value, message) {
      return this.setLimit("min", value, false, errorUtil.toString(message));
    }
    lte(value, message) {
      return this.setLimit("max", value, true, errorUtil.toString(message));
    }
    lt(value, message) {
      return this.setLimit("max", value, false, errorUtil.toString(message));
    }
    setLimit(kind, value, inclusive, message) {
      return new _ZodNumber({
        ...this._def,
        checks: [
          ...this._def.checks,
          {
            kind,
            value,
            inclusive,
            message: errorUtil.toString(message)
          }
        ]
      });
    }
    _addCheck(check) {
      return new _ZodNumber({
        ...this._def,
        checks: [...this._def.checks, check]
      });
    }
    int(message) {
      return this._addCheck({
        kind: "int",
        message: errorUtil.toString(message)
      });
    }
    positive(message) {
      return this._addCheck({
        kind: "min",
        value: 0,
        inclusive: false,
        message: errorUtil.toString(message)
      });
    }
    negative(message) {
      return this._addCheck({
        kind: "max",
        value: 0,
        inclusive: false,
        message: errorUtil.toString(message)
      });
    }
    nonpositive(message) {
      return this._addCheck({
        kind: "max",
        value: 0,
        inclusive: true,
        message: errorUtil.toString(message)
      });
    }
    nonnegative(message) {
      return this._addCheck({
        kind: "min",
        value: 0,
        inclusive: true,
        message: errorUtil.toString(message)
      });
    }
    multipleOf(value, message) {
      return this._addCheck({
        kind: "multipleOf",
        value,
        message: errorUtil.toString(message)
      });
    }
    finite(message) {
      return this._addCheck({
        kind: "finite",
        message: errorUtil.toString(message)
      });
    }
    safe(message) {
      return this._addCheck({
        kind: "min",
        inclusive: true,
        value: Number.MIN_SAFE_INTEGER,
        message: errorUtil.toString(message)
      })._addCheck({
        kind: "max",
        inclusive: true,
        value: Number.MAX_SAFE_INTEGER,
        message: errorUtil.toString(message)
      });
    }
    get minValue() {
      let min = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "min") {
          if (min === null || ch.value > min)
            min = ch.value;
        }
      }
      return min;
    }
    get maxValue() {
      let max = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "max") {
          if (max === null || ch.value < max)
            max = ch.value;
        }
      }
      return max;
    }
    get isInt() {
      return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
    }
    get isFinite() {
      let max = null;
      let min = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
          return true;
        } else if (ch.kind === "min") {
          if (min === null || ch.value > min)
            min = ch.value;
        } else if (ch.kind === "max") {
          if (max === null || ch.value < max)
            max = ch.value;
        }
      }
      return Number.isFinite(min) && Number.isFinite(max);
    }
  };
  ZodNumber.create = (params) => {
    return new ZodNumber({
      checks: [],
      typeName: ZodFirstPartyTypeKind.ZodNumber,
      coerce: params?.coerce || false,
      ...processCreateParams(params)
    });
  };
  var ZodBigInt = class _ZodBigInt extends ZodType {
    constructor() {
      super(...arguments);
      this.min = this.gte;
      this.max = this.lte;
    }
    _parse(input) {
      if (this._def.coerce) {
        try {
          input.data = BigInt(input.data);
        } catch {
          return this._getInvalidInput(input);
        }
      }
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.bigint) {
        return this._getInvalidInput(input);
      }
      let ctx = void 0;
      const status = new ParseStatus();
      for (const check of this._def.checks) {
        if (check.kind === "min") {
          const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
          if (tooSmall) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              type: "bigint",
              minimum: check.value,
              inclusive: check.inclusive,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "max") {
          const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
          if (tooBig) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              type: "bigint",
              maximum: check.value,
              inclusive: check.inclusive,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "multipleOf") {
          if (input.data % check.value !== BigInt(0)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.not_multiple_of,
              multipleOf: check.value,
              message: check.message
            });
            status.dirty();
          }
        } else {
          util.assertNever(check);
        }
      }
      return { status: status.value, value: input.data };
    }
    _getInvalidInput(input) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.bigint,
        received: ctx.parsedType
      });
      return INVALID;
    }
    gte(value, message) {
      return this.setLimit("min", value, true, errorUtil.toString(message));
    }
    gt(value, message) {
      return this.setLimit("min", value, false, errorUtil.toString(message));
    }
    lte(value, message) {
      return this.setLimit("max", value, true, errorUtil.toString(message));
    }
    lt(value, message) {
      return this.setLimit("max", value, false, errorUtil.toString(message));
    }
    setLimit(kind, value, inclusive, message) {
      return new _ZodBigInt({
        ...this._def,
        checks: [
          ...this._def.checks,
          {
            kind,
            value,
            inclusive,
            message: errorUtil.toString(message)
          }
        ]
      });
    }
    _addCheck(check) {
      return new _ZodBigInt({
        ...this._def,
        checks: [...this._def.checks, check]
      });
    }
    positive(message) {
      return this._addCheck({
        kind: "min",
        value: BigInt(0),
        inclusive: false,
        message: errorUtil.toString(message)
      });
    }
    negative(message) {
      return this._addCheck({
        kind: "max",
        value: BigInt(0),
        inclusive: false,
        message: errorUtil.toString(message)
      });
    }
    nonpositive(message) {
      return this._addCheck({
        kind: "max",
        value: BigInt(0),
        inclusive: true,
        message: errorUtil.toString(message)
      });
    }
    nonnegative(message) {
      return this._addCheck({
        kind: "min",
        value: BigInt(0),
        inclusive: true,
        message: errorUtil.toString(message)
      });
    }
    multipleOf(value, message) {
      return this._addCheck({
        kind: "multipleOf",
        value,
        message: errorUtil.toString(message)
      });
    }
    get minValue() {
      let min = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "min") {
          if (min === null || ch.value > min)
            min = ch.value;
        }
      }
      return min;
    }
    get maxValue() {
      let max = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "max") {
          if (max === null || ch.value < max)
            max = ch.value;
        }
      }
      return max;
    }
  };
  ZodBigInt.create = (params) => {
    return new ZodBigInt({
      checks: [],
      typeName: ZodFirstPartyTypeKind.ZodBigInt,
      coerce: params?.coerce ?? false,
      ...processCreateParams(params)
    });
  };
  var ZodBoolean = class extends ZodType {
    _parse(input) {
      if (this._def.coerce) {
        input.data = Boolean(input.data);
      }
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.boolean) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.boolean,
          received: ctx.parsedType
        });
        return INVALID;
      }
      return OK(input.data);
    }
  };
  ZodBoolean.create = (params) => {
    return new ZodBoolean({
      typeName: ZodFirstPartyTypeKind.ZodBoolean,
      coerce: params?.coerce || false,
      ...processCreateParams(params)
    });
  };
  var ZodDate = class _ZodDate extends ZodType {
    _parse(input) {
      if (this._def.coerce) {
        input.data = new Date(input.data);
      }
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.date) {
        const ctx2 = this._getOrReturnCtx(input);
        addIssueToContext(ctx2, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.date,
          received: ctx2.parsedType
        });
        return INVALID;
      }
      if (Number.isNaN(input.data.getTime())) {
        const ctx2 = this._getOrReturnCtx(input);
        addIssueToContext(ctx2, {
          code: ZodIssueCode.invalid_date
        });
        return INVALID;
      }
      const status = new ParseStatus();
      let ctx = void 0;
      for (const check of this._def.checks) {
        if (check.kind === "min") {
          if (input.data.getTime() < check.value) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              message: check.message,
              inclusive: true,
              exact: false,
              minimum: check.value,
              type: "date"
            });
            status.dirty();
          }
        } else if (check.kind === "max") {
          if (input.data.getTime() > check.value) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              message: check.message,
              inclusive: true,
              exact: false,
              maximum: check.value,
              type: "date"
            });
            status.dirty();
          }
        } else {
          util.assertNever(check);
        }
      }
      return {
        status: status.value,
        value: new Date(input.data.getTime())
      };
    }
    _addCheck(check) {
      return new _ZodDate({
        ...this._def,
        checks: [...this._def.checks, check]
      });
    }
    min(minDate, message) {
      return this._addCheck({
        kind: "min",
        value: minDate.getTime(),
        message: errorUtil.toString(message)
      });
    }
    max(maxDate, message) {
      return this._addCheck({
        kind: "max",
        value: maxDate.getTime(),
        message: errorUtil.toString(message)
      });
    }
    get minDate() {
      let min = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "min") {
          if (min === null || ch.value > min)
            min = ch.value;
        }
      }
      return min != null ? new Date(min) : null;
    }
    get maxDate() {
      let max = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "max") {
          if (max === null || ch.value < max)
            max = ch.value;
        }
      }
      return max != null ? new Date(max) : null;
    }
  };
  ZodDate.create = (params) => {
    return new ZodDate({
      checks: [],
      coerce: params?.coerce || false,
      typeName: ZodFirstPartyTypeKind.ZodDate,
      ...processCreateParams(params)
    });
  };
  var ZodSymbol = class extends ZodType {
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.symbol) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.symbol,
          received: ctx.parsedType
        });
        return INVALID;
      }
      return OK(input.data);
    }
  };
  ZodSymbol.create = (params) => {
    return new ZodSymbol({
      typeName: ZodFirstPartyTypeKind.ZodSymbol,
      ...processCreateParams(params)
    });
  };
  var ZodUndefined = class extends ZodType {
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.undefined) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.undefined,
          received: ctx.parsedType
        });
        return INVALID;
      }
      return OK(input.data);
    }
  };
  ZodUndefined.create = (params) => {
    return new ZodUndefined({
      typeName: ZodFirstPartyTypeKind.ZodUndefined,
      ...processCreateParams(params)
    });
  };
  var ZodNull = class extends ZodType {
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.null) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.null,
          received: ctx.parsedType
        });
        return INVALID;
      }
      return OK(input.data);
    }
  };
  ZodNull.create = (params) => {
    return new ZodNull({
      typeName: ZodFirstPartyTypeKind.ZodNull,
      ...processCreateParams(params)
    });
  };
  var ZodAny = class extends ZodType {
    constructor() {
      super(...arguments);
      this._any = true;
    }
    _parse(input) {
      return OK(input.data);
    }
  };
  ZodAny.create = (params) => {
    return new ZodAny({
      typeName: ZodFirstPartyTypeKind.ZodAny,
      ...processCreateParams(params)
    });
  };
  var ZodUnknown = class extends ZodType {
    constructor() {
      super(...arguments);
      this._unknown = true;
    }
    _parse(input) {
      return OK(input.data);
    }
  };
  ZodUnknown.create = (params) => {
    return new ZodUnknown({
      typeName: ZodFirstPartyTypeKind.ZodUnknown,
      ...processCreateParams(params)
    });
  };
  var ZodNever = class extends ZodType {
    _parse(input) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.never,
        received: ctx.parsedType
      });
      return INVALID;
    }
  };
  ZodNever.create = (params) => {
    return new ZodNever({
      typeName: ZodFirstPartyTypeKind.ZodNever,
      ...processCreateParams(params)
    });
  };
  var ZodVoid = class extends ZodType {
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.undefined) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.void,
          received: ctx.parsedType
        });
        return INVALID;
      }
      return OK(input.data);
    }
  };
  ZodVoid.create = (params) => {
    return new ZodVoid({
      typeName: ZodFirstPartyTypeKind.ZodVoid,
      ...processCreateParams(params)
    });
  };
  var ZodArray = class _ZodArray extends ZodType {
    _parse(input) {
      const { ctx, status } = this._processInputParams(input);
      const def = this._def;
      if (ctx.parsedType !== ZodParsedType.array) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.array,
          received: ctx.parsedType
        });
        return INVALID;
      }
      if (def.exactLength !== null) {
        const tooBig = ctx.data.length > def.exactLength.value;
        const tooSmall = ctx.data.length < def.exactLength.value;
        if (tooBig || tooSmall) {
          addIssueToContext(ctx, {
            code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
            minimum: tooSmall ? def.exactLength.value : void 0,
            maximum: tooBig ? def.exactLength.value : void 0,
            type: "array",
            inclusive: true,
            exact: true,
            message: def.exactLength.message
          });
          status.dirty();
        }
      }
      if (def.minLength !== null) {
        if (ctx.data.length < def.minLength.value) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: def.minLength.value,
            type: "array",
            inclusive: true,
            exact: false,
            message: def.minLength.message
          });
          status.dirty();
        }
      }
      if (def.maxLength !== null) {
        if (ctx.data.length > def.maxLength.value) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: def.maxLength.value,
            type: "array",
            inclusive: true,
            exact: false,
            message: def.maxLength.message
          });
          status.dirty();
        }
      }
      if (ctx.common.async) {
        return Promise.all([...ctx.data].map((item, i) => {
          return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
        })).then((result2) => {
          return ParseStatus.mergeArray(status, result2);
        });
      }
      const result = [...ctx.data].map((item, i) => {
        return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
      });
      return ParseStatus.mergeArray(status, result);
    }
    get element() {
      return this._def.type;
    }
    min(minLength, message) {
      return new _ZodArray({
        ...this._def,
        minLength: { value: minLength, message: errorUtil.toString(message) }
      });
    }
    max(maxLength, message) {
      return new _ZodArray({
        ...this._def,
        maxLength: { value: maxLength, message: errorUtil.toString(message) }
      });
    }
    length(len, message) {
      return new _ZodArray({
        ...this._def,
        exactLength: { value: len, message: errorUtil.toString(message) }
      });
    }
    nonempty(message) {
      return this.min(1, message);
    }
  };
  ZodArray.create = (schema, params) => {
    return new ZodArray({
      type: schema,
      minLength: null,
      maxLength: null,
      exactLength: null,
      typeName: ZodFirstPartyTypeKind.ZodArray,
      ...processCreateParams(params)
    });
  };
  function deepPartialify(schema) {
    if (schema instanceof ZodObject) {
      const newShape = {};
      for (const key in schema.shape) {
        const fieldSchema = schema.shape[key];
        newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
      }
      return new ZodObject({
        ...schema._def,
        shape: () => newShape
      });
    } else if (schema instanceof ZodArray) {
      return new ZodArray({
        ...schema._def,
        type: deepPartialify(schema.element)
      });
    } else if (schema instanceof ZodOptional) {
      return ZodOptional.create(deepPartialify(schema.unwrap()));
    } else if (schema instanceof ZodNullable) {
      return ZodNullable.create(deepPartialify(schema.unwrap()));
    } else if (schema instanceof ZodTuple) {
      return ZodTuple.create(schema.items.map((item) => deepPartialify(item)));
    } else {
      return schema;
    }
  }
  var ZodObject = class _ZodObject extends ZodType {
    constructor() {
      super(...arguments);
      this._cached = null;
      this.nonstrict = this.passthrough;
      this.augment = this.extend;
    }
    _getCached() {
      if (this._cached !== null)
        return this._cached;
      const shape = this._def.shape();
      const keys = util.objectKeys(shape);
      this._cached = { shape, keys };
      return this._cached;
    }
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.object) {
        const ctx2 = this._getOrReturnCtx(input);
        addIssueToContext(ctx2, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.object,
          received: ctx2.parsedType
        });
        return INVALID;
      }
      const { status, ctx } = this._processInputParams(input);
      const { shape, keys: shapeKeys } = this._getCached();
      const extraKeys = [];
      if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
        for (const key in ctx.data) {
          if (!shapeKeys.includes(key)) {
            extraKeys.push(key);
          }
        }
      }
      const pairs = [];
      for (const key of shapeKeys) {
        const keyValidator = shape[key];
        const value = ctx.data[key];
        pairs.push({
          key: { status: "valid", value: key },
          value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
          alwaysSet: key in ctx.data
        });
      }
      if (this._def.catchall instanceof ZodNever) {
        const unknownKeys = this._def.unknownKeys;
        if (unknownKeys === "passthrough") {
          for (const key of extraKeys) {
            pairs.push({
              key: { status: "valid", value: key },
              value: { status: "valid", value: ctx.data[key] }
            });
          }
        } else if (unknownKeys === "strict") {
          if (extraKeys.length > 0) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.unrecognized_keys,
              keys: extraKeys
            });
            status.dirty();
          }
        } else if (unknownKeys === "strip") {
        } else {
          throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
        }
      } else {
        const catchall = this._def.catchall;
        for (const key of extraKeys) {
          const value = ctx.data[key];
          pairs.push({
            key: { status: "valid", value: key },
            value: catchall._parse(
              new ParseInputLazyPath(ctx, value, ctx.path, key)
              //, ctx.child(key), value, getParsedType(value)
            ),
            alwaysSet: key in ctx.data
          });
        }
      }
      if (ctx.common.async) {
        return Promise.resolve().then(async () => {
          const syncPairs = [];
          for (const pair of pairs) {
            const key = await pair.key;
            const value = await pair.value;
            syncPairs.push({
              key,
              value,
              alwaysSet: pair.alwaysSet
            });
          }
          return syncPairs;
        }).then((syncPairs) => {
          return ParseStatus.mergeObjectSync(status, syncPairs);
        });
      } else {
        return ParseStatus.mergeObjectSync(status, pairs);
      }
    }
    get shape() {
      return this._def.shape();
    }
    strict(message) {
      errorUtil.errToObj;
      return new _ZodObject({
        ...this._def,
        unknownKeys: "strict",
        ...message !== void 0 ? {
          errorMap: (issue, ctx) => {
            const defaultError = this._def.errorMap?.(issue, ctx).message ?? ctx.defaultError;
            if (issue.code === "unrecognized_keys")
              return {
                message: errorUtil.errToObj(message).message ?? defaultError
              };
            return {
              message: defaultError
            };
          }
        } : {}
      });
    }
    strip() {
      return new _ZodObject({
        ...this._def,
        unknownKeys: "strip"
      });
    }
    passthrough() {
      return new _ZodObject({
        ...this._def,
        unknownKeys: "passthrough"
      });
    }
    // const AugmentFactory =
    //   <Def extends ZodObjectDef>(def: Def) =>
    //   <Augmentation extends ZodRawShape>(
    //     augmentation: Augmentation
    //   ): ZodObject<
    //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
    //     Def["unknownKeys"],
    //     Def["catchall"]
    //   > => {
    //     return new ZodObject({
    //       ...def,
    //       shape: () => ({
    //         ...def.shape(),
    //         ...augmentation,
    //       }),
    //     }) as any;
    //   };
    extend(augmentation) {
      return new _ZodObject({
        ...this._def,
        shape: () => ({
          ...this._def.shape(),
          ...augmentation
        })
      });
    }
    /**
     * Prior to zod@1.0.12 there was a bug in the
     * inferred type of merged objects. Please
     * upgrade if you are experiencing issues.
     */
    merge(merging) {
      const merged = new _ZodObject({
        unknownKeys: merging._def.unknownKeys,
        catchall: merging._def.catchall,
        shape: () => ({
          ...this._def.shape(),
          ...merging._def.shape()
        }),
        typeName: ZodFirstPartyTypeKind.ZodObject
      });
      return merged;
    }
    // merge<
    //   Incoming extends AnyZodObject,
    //   Augmentation extends Incoming["shape"],
    //   NewOutput extends {
    //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
    //       ? Augmentation[k]["_output"]
    //       : k extends keyof Output
    //       ? Output[k]
    //       : never;
    //   },
    //   NewInput extends {
    //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
    //       ? Augmentation[k]["_input"]
    //       : k extends keyof Input
    //       ? Input[k]
    //       : never;
    //   }
    // >(
    //   merging: Incoming
    // ): ZodObject<
    //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
    //   Incoming["_def"]["unknownKeys"],
    //   Incoming["_def"]["catchall"],
    //   NewOutput,
    //   NewInput
    // > {
    //   const merged: any = new ZodObject({
    //     unknownKeys: merging._def.unknownKeys,
    //     catchall: merging._def.catchall,
    //     shape: () =>
    //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
    //     typeName: ZodFirstPartyTypeKind.ZodObject,
    //   }) as any;
    //   return merged;
    // }
    setKey(key, schema) {
      return this.augment({ [key]: schema });
    }
    // merge<Incoming extends AnyZodObject>(
    //   merging: Incoming
    // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
    // ZodObject<
    //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
    //   Incoming["_def"]["unknownKeys"],
    //   Incoming["_def"]["catchall"]
    // > {
    //   // const mergedShape = objectUtil.mergeShapes(
    //   //   this._def.shape(),
    //   //   merging._def.shape()
    //   // );
    //   const merged: any = new ZodObject({
    //     unknownKeys: merging._def.unknownKeys,
    //     catchall: merging._def.catchall,
    //     shape: () =>
    //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
    //     typeName: ZodFirstPartyTypeKind.ZodObject,
    //   }) as any;
    //   return merged;
    // }
    catchall(index) {
      return new _ZodObject({
        ...this._def,
        catchall: index
      });
    }
    pick(mask) {
      const shape = {};
      for (const key of util.objectKeys(mask)) {
        if (mask[key] && this.shape[key]) {
          shape[key] = this.shape[key];
        }
      }
      return new _ZodObject({
        ...this._def,
        shape: () => shape
      });
    }
    omit(mask) {
      const shape = {};
      for (const key of util.objectKeys(this.shape)) {
        if (!mask[key]) {
          shape[key] = this.shape[key];
        }
      }
      return new _ZodObject({
        ...this._def,
        shape: () => shape
      });
    }
    /**
     * @deprecated
     */
    deepPartial() {
      return deepPartialify(this);
    }
    partial(mask) {
      const newShape = {};
      for (const key of util.objectKeys(this.shape)) {
        const fieldSchema = this.shape[key];
        if (mask && !mask[key]) {
          newShape[key] = fieldSchema;
        } else {
          newShape[key] = fieldSchema.optional();
        }
      }
      return new _ZodObject({
        ...this._def,
        shape: () => newShape
      });
    }
    required(mask) {
      const newShape = {};
      for (const key of util.objectKeys(this.shape)) {
        if (mask && !mask[key]) {
          newShape[key] = this.shape[key];
        } else {
          const fieldSchema = this.shape[key];
          let newField = fieldSchema;
          while (newField instanceof ZodOptional) {
            newField = newField._def.innerType;
          }
          newShape[key] = newField;
        }
      }
      return new _ZodObject({
        ...this._def,
        shape: () => newShape
      });
    }
    keyof() {
      return createZodEnum(util.objectKeys(this.shape));
    }
  };
  ZodObject.create = (shape, params) => {
    return new ZodObject({
      shape: () => shape,
      unknownKeys: "strip",
      catchall: ZodNever.create(),
      typeName: ZodFirstPartyTypeKind.ZodObject,
      ...processCreateParams(params)
    });
  };
  ZodObject.strictCreate = (shape, params) => {
    return new ZodObject({
      shape: () => shape,
      unknownKeys: "strict",
      catchall: ZodNever.create(),
      typeName: ZodFirstPartyTypeKind.ZodObject,
      ...processCreateParams(params)
    });
  };
  ZodObject.lazycreate = (shape, params) => {
    return new ZodObject({
      shape,
      unknownKeys: "strip",
      catchall: ZodNever.create(),
      typeName: ZodFirstPartyTypeKind.ZodObject,
      ...processCreateParams(params)
    });
  };
  var ZodUnion = class extends ZodType {
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      const options = this._def.options;
      function handleResults(results) {
        for (const result of results) {
          if (result.result.status === "valid") {
            return result.result;
          }
        }
        for (const result of results) {
          if (result.result.status === "dirty") {
            ctx.common.issues.push(...result.ctx.common.issues);
            return result.result;
          }
        }
        const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_union,
          unionErrors
        });
        return INVALID;
      }
      if (ctx.common.async) {
        return Promise.all(options.map(async (option) => {
          const childCtx = {
            ...ctx,
            common: {
              ...ctx.common,
              issues: []
            },
            parent: null
          };
          return {
            result: await option._parseAsync({
              data: ctx.data,
              path: ctx.path,
              parent: childCtx
            }),
            ctx: childCtx
          };
        })).then(handleResults);
      } else {
        let dirty = void 0;
        const issues = [];
        for (const option of options) {
          const childCtx = {
            ...ctx,
            common: {
              ...ctx.common,
              issues: []
            },
            parent: null
          };
          const result = option._parseSync({
            data: ctx.data,
            path: ctx.path,
            parent: childCtx
          });
          if (result.status === "valid") {
            return result;
          } else if (result.status === "dirty" && !dirty) {
            dirty = { result, ctx: childCtx };
          }
          if (childCtx.common.issues.length) {
            issues.push(childCtx.common.issues);
          }
        }
        if (dirty) {
          ctx.common.issues.push(...dirty.ctx.common.issues);
          return dirty.result;
        }
        const unionErrors = issues.map((issues2) => new ZodError(issues2));
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_union,
          unionErrors
        });
        return INVALID;
      }
    }
    get options() {
      return this._def.options;
    }
  };
  ZodUnion.create = (types, params) => {
    return new ZodUnion({
      options: types,
      typeName: ZodFirstPartyTypeKind.ZodUnion,
      ...processCreateParams(params)
    });
  };
  var getDiscriminator = (type) => {
    if (type instanceof ZodLazy) {
      return getDiscriminator(type.schema);
    } else if (type instanceof ZodEffects) {
      return getDiscriminator(type.innerType());
    } else if (type instanceof ZodLiteral) {
      return [type.value];
    } else if (type instanceof ZodEnum) {
      return type.options;
    } else if (type instanceof ZodNativeEnum) {
      return util.objectValues(type.enum);
    } else if (type instanceof ZodDefault) {
      return getDiscriminator(type._def.innerType);
    } else if (type instanceof ZodUndefined) {
      return [void 0];
    } else if (type instanceof ZodNull) {
      return [null];
    } else if (type instanceof ZodOptional) {
      return [void 0, ...getDiscriminator(type.unwrap())];
    } else if (type instanceof ZodNullable) {
      return [null, ...getDiscriminator(type.unwrap())];
    } else if (type instanceof ZodBranded) {
      return getDiscriminator(type.unwrap());
    } else if (type instanceof ZodReadonly) {
      return getDiscriminator(type.unwrap());
    } else if (type instanceof ZodCatch) {
      return getDiscriminator(type._def.innerType);
    } else {
      return [];
    }
  };
  var ZodDiscriminatedUnion = class _ZodDiscriminatedUnion extends ZodType {
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      if (ctx.parsedType !== ZodParsedType.object) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.object,
          received: ctx.parsedType
        });
        return INVALID;
      }
      const discriminator = this.discriminator;
      const discriminatorValue = ctx.data[discriminator];
      const option = this.optionsMap.get(discriminatorValue);
      if (!option) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_union_discriminator,
          options: Array.from(this.optionsMap.keys()),
          path: [discriminator]
        });
        return INVALID;
      }
      if (ctx.common.async) {
        return option._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
      } else {
        return option._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
      }
    }
    get discriminator() {
      return this._def.discriminator;
    }
    get options() {
      return this._def.options;
    }
    get optionsMap() {
      return this._def.optionsMap;
    }
    /**
     * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
     * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
     * have a different value for each object in the union.
     * @param discriminator the name of the discriminator property
     * @param types an array of object schemas
     * @param params
     */
    static create(discriminator, options, params) {
      const optionsMap = /* @__PURE__ */ new Map();
      for (const type of options) {
        const discriminatorValues = getDiscriminator(type.shape[discriminator]);
        if (!discriminatorValues.length) {
          throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
        }
        for (const value of discriminatorValues) {
          if (optionsMap.has(value)) {
            throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
          }
          optionsMap.set(value, type);
        }
      }
      return new _ZodDiscriminatedUnion({
        typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
        discriminator,
        options,
        optionsMap,
        ...processCreateParams(params)
      });
    }
  };
  function mergeValues(a, b) {
    const aType = getParsedType(a);
    const bType = getParsedType(b);
    if (a === b) {
      return { valid: true, data: a };
    } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
      const bKeys = util.objectKeys(b);
      const sharedKeys = util.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
      const newObj = { ...a, ...b };
      for (const key of sharedKeys) {
        const sharedValue = mergeValues(a[key], b[key]);
        if (!sharedValue.valid) {
          return { valid: false };
        }
        newObj[key] = sharedValue.data;
      }
      return { valid: true, data: newObj };
    } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
      if (a.length !== b.length) {
        return { valid: false };
      }
      const newArray = [];
      for (let index = 0; index < a.length; index++) {
        const itemA = a[index];
        const itemB = b[index];
        const sharedValue = mergeValues(itemA, itemB);
        if (!sharedValue.valid) {
          return { valid: false };
        }
        newArray.push(sharedValue.data);
      }
      return { valid: true, data: newArray };
    } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b) {
      return { valid: true, data: a };
    } else {
      return { valid: false };
    }
  }
  var ZodIntersection = class extends ZodType {
    _parse(input) {
      const { status, ctx } = this._processInputParams(input);
      const handleParsed = (parsedLeft, parsedRight) => {
        if (isAborted(parsedLeft) || isAborted(parsedRight)) {
          return INVALID;
        }
        const merged = mergeValues(parsedLeft.value, parsedRight.value);
        if (!merged.valid) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_intersection_types
          });
          return INVALID;
        }
        if (isDirty(parsedLeft) || isDirty(parsedRight)) {
          status.dirty();
        }
        return { status: status.value, value: merged.data };
      };
      if (ctx.common.async) {
        return Promise.all([
          this._def.left._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          }),
          this._def.right._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          })
        ]).then(([left, right]) => handleParsed(left, right));
      } else {
        return handleParsed(this._def.left._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }), this._def.right._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }));
      }
    }
  };
  ZodIntersection.create = (left, right, params) => {
    return new ZodIntersection({
      left,
      right,
      typeName: ZodFirstPartyTypeKind.ZodIntersection,
      ...processCreateParams(params)
    });
  };
  var ZodTuple = class _ZodTuple extends ZodType {
    _parse(input) {
      const { status, ctx } = this._processInputParams(input);
      if (ctx.parsedType !== ZodParsedType.array) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.array,
          received: ctx.parsedType
        });
        return INVALID;
      }
      if (ctx.data.length < this._def.items.length) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: this._def.items.length,
          inclusive: true,
          exact: false,
          type: "array"
        });
        return INVALID;
      }
      const rest = this._def.rest;
      if (!rest && ctx.data.length > this._def.items.length) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: this._def.items.length,
          inclusive: true,
          exact: false,
          type: "array"
        });
        status.dirty();
      }
      const items = [...ctx.data].map((item, itemIndex) => {
        const schema = this._def.items[itemIndex] || this._def.rest;
        if (!schema)
          return null;
        return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
      }).filter((x) => !!x);
      if (ctx.common.async) {
        return Promise.all(items).then((results) => {
          return ParseStatus.mergeArray(status, results);
        });
      } else {
        return ParseStatus.mergeArray(status, items);
      }
    }
    get items() {
      return this._def.items;
    }
    rest(rest) {
      return new _ZodTuple({
        ...this._def,
        rest
      });
    }
  };
  ZodTuple.create = (schemas, params) => {
    if (!Array.isArray(schemas)) {
      throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
    }
    return new ZodTuple({
      items: schemas,
      typeName: ZodFirstPartyTypeKind.ZodTuple,
      rest: null,
      ...processCreateParams(params)
    });
  };
  var ZodRecord = class _ZodRecord extends ZodType {
    get keySchema() {
      return this._def.keyType;
    }
    get valueSchema() {
      return this._def.valueType;
    }
    _parse(input) {
      const { status, ctx } = this._processInputParams(input);
      if (ctx.parsedType !== ZodParsedType.object) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.object,
          received: ctx.parsedType
        });
        return INVALID;
      }
      const pairs = [];
      const keyType = this._def.keyType;
      const valueType = this._def.valueType;
      for (const key in ctx.data) {
        pairs.push({
          key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
          value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
          alwaysSet: key in ctx.data
        });
      }
      if (ctx.common.async) {
        return ParseStatus.mergeObjectAsync(status, pairs);
      } else {
        return ParseStatus.mergeObjectSync(status, pairs);
      }
    }
    get element() {
      return this._def.valueType;
    }
    static create(first, second, third) {
      if (second instanceof ZodType) {
        return new _ZodRecord({
          keyType: first,
          valueType: second,
          typeName: ZodFirstPartyTypeKind.ZodRecord,
          ...processCreateParams(third)
        });
      }
      return new _ZodRecord({
        keyType: ZodString.create(),
        valueType: first,
        typeName: ZodFirstPartyTypeKind.ZodRecord,
        ...processCreateParams(second)
      });
    }
  };
  var ZodMap = class extends ZodType {
    get keySchema() {
      return this._def.keyType;
    }
    get valueSchema() {
      return this._def.valueType;
    }
    _parse(input) {
      const { status, ctx } = this._processInputParams(input);
      if (ctx.parsedType !== ZodParsedType.map) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.map,
          received: ctx.parsedType
        });
        return INVALID;
      }
      const keyType = this._def.keyType;
      const valueType = this._def.valueType;
      const pairs = [...ctx.data.entries()].map(([key, value], index) => {
        return {
          key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
          value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"]))
        };
      });
      if (ctx.common.async) {
        const finalMap = /* @__PURE__ */ new Map();
        return Promise.resolve().then(async () => {
          for (const pair of pairs) {
            const key = await pair.key;
            const value = await pair.value;
            if (key.status === "aborted" || value.status === "aborted") {
              return INVALID;
            }
            if (key.status === "dirty" || value.status === "dirty") {
              status.dirty();
            }
            finalMap.set(key.value, value.value);
          }
          return { status: status.value, value: finalMap };
        });
      } else {
        const finalMap = /* @__PURE__ */ new Map();
        for (const pair of pairs) {
          const key = pair.key;
          const value = pair.value;
          if (key.status === "aborted" || value.status === "aborted") {
            return INVALID;
          }
          if (key.status === "dirty" || value.status === "dirty") {
            status.dirty();
          }
          finalMap.set(key.value, value.value);
        }
        return { status: status.value, value: finalMap };
      }
    }
  };
  ZodMap.create = (keyType, valueType, params) => {
    return new ZodMap({
      valueType,
      keyType,
      typeName: ZodFirstPartyTypeKind.ZodMap,
      ...processCreateParams(params)
    });
  };
  var ZodSet = class _ZodSet extends ZodType {
    _parse(input) {
      const { status, ctx } = this._processInputParams(input);
      if (ctx.parsedType !== ZodParsedType.set) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.set,
          received: ctx.parsedType
        });
        return INVALID;
      }
      const def = this._def;
      if (def.minSize !== null) {
        if (ctx.data.size < def.minSize.value) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: def.minSize.value,
            type: "set",
            inclusive: true,
            exact: false,
            message: def.minSize.message
          });
          status.dirty();
        }
      }
      if (def.maxSize !== null) {
        if (ctx.data.size > def.maxSize.value) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: def.maxSize.value,
            type: "set",
            inclusive: true,
            exact: false,
            message: def.maxSize.message
          });
          status.dirty();
        }
      }
      const valueType = this._def.valueType;
      function finalizeSet(elements2) {
        const parsedSet = /* @__PURE__ */ new Set();
        for (const element of elements2) {
          if (element.status === "aborted")
            return INVALID;
          if (element.status === "dirty")
            status.dirty();
          parsedSet.add(element.value);
        }
        return { status: status.value, value: parsedSet };
      }
      const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
      if (ctx.common.async) {
        return Promise.all(elements).then((elements2) => finalizeSet(elements2));
      } else {
        return finalizeSet(elements);
      }
    }
    min(minSize, message) {
      return new _ZodSet({
        ...this._def,
        minSize: { value: minSize, message: errorUtil.toString(message) }
      });
    }
    max(maxSize, message) {
      return new _ZodSet({
        ...this._def,
        maxSize: { value: maxSize, message: errorUtil.toString(message) }
      });
    }
    size(size, message) {
      return this.min(size, message).max(size, message);
    }
    nonempty(message) {
      return this.min(1, message);
    }
  };
  ZodSet.create = (valueType, params) => {
    return new ZodSet({
      valueType,
      minSize: null,
      maxSize: null,
      typeName: ZodFirstPartyTypeKind.ZodSet,
      ...processCreateParams(params)
    });
  };
  var ZodFunction = class _ZodFunction extends ZodType {
    constructor() {
      super(...arguments);
      this.validate = this.implement;
    }
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      if (ctx.parsedType !== ZodParsedType.function) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.function,
          received: ctx.parsedType
        });
        return INVALID;
      }
      function makeArgsIssue(args, error) {
        return makeIssue({
          data: args,
          path: ctx.path,
          errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
          issueData: {
            code: ZodIssueCode.invalid_arguments,
            argumentsError: error
          }
        });
      }
      function makeReturnsIssue(returns, error) {
        return makeIssue({
          data: returns,
          path: ctx.path,
          errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
          issueData: {
            code: ZodIssueCode.invalid_return_type,
            returnTypeError: error
          }
        });
      }
      const params = { errorMap: ctx.common.contextualErrorMap };
      const fn = ctx.data;
      if (this._def.returns instanceof ZodPromise) {
        const me = this;
        return OK(async function(...args) {
          const error = new ZodError([]);
          const parsedArgs = await me._def.args.parseAsync(args, params).catch((e) => {
            error.addIssue(makeArgsIssue(args, e));
            throw error;
          });
          const result = await Reflect.apply(fn, this, parsedArgs);
          const parsedReturns = await me._def.returns._def.type.parseAsync(result, params).catch((e) => {
            error.addIssue(makeReturnsIssue(result, e));
            throw error;
          });
          return parsedReturns;
        });
      } else {
        const me = this;
        return OK(function(...args) {
          const parsedArgs = me._def.args.safeParse(args, params);
          if (!parsedArgs.success) {
            throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
          }
          const result = Reflect.apply(fn, this, parsedArgs.data);
          const parsedReturns = me._def.returns.safeParse(result, params);
          if (!parsedReturns.success) {
            throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
          }
          return parsedReturns.data;
        });
      }
    }
    parameters() {
      return this._def.args;
    }
    returnType() {
      return this._def.returns;
    }
    args(...items) {
      return new _ZodFunction({
        ...this._def,
        args: ZodTuple.create(items).rest(ZodUnknown.create())
      });
    }
    returns(returnType) {
      return new _ZodFunction({
        ...this._def,
        returns: returnType
      });
    }
    implement(func) {
      const validatedFunc = this.parse(func);
      return validatedFunc;
    }
    strictImplement(func) {
      const validatedFunc = this.parse(func);
      return validatedFunc;
    }
    static create(args, returns, params) {
      return new _ZodFunction({
        args: args ? args : ZodTuple.create([]).rest(ZodUnknown.create()),
        returns: returns || ZodUnknown.create(),
        typeName: ZodFirstPartyTypeKind.ZodFunction,
        ...processCreateParams(params)
      });
    }
  };
  var ZodLazy = class extends ZodType {
    get schema() {
      return this._def.getter();
    }
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      const lazySchema = this._def.getter();
      return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
    }
  };
  ZodLazy.create = (getter, params) => {
    return new ZodLazy({
      getter,
      typeName: ZodFirstPartyTypeKind.ZodLazy,
      ...processCreateParams(params)
    });
  };
  var ZodLiteral = class extends ZodType {
    _parse(input) {
      if (input.data !== this._def.value) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          received: ctx.data,
          code: ZodIssueCode.invalid_literal,
          expected: this._def.value
        });
        return INVALID;
      }
      return { status: "valid", value: input.data };
    }
    get value() {
      return this._def.value;
    }
  };
  ZodLiteral.create = (value, params) => {
    return new ZodLiteral({
      value,
      typeName: ZodFirstPartyTypeKind.ZodLiteral,
      ...processCreateParams(params)
    });
  };
  function createZodEnum(values, params) {
    return new ZodEnum({
      values,
      typeName: ZodFirstPartyTypeKind.ZodEnum,
      ...processCreateParams(params)
    });
  }
  var ZodEnum = class _ZodEnum extends ZodType {
    _parse(input) {
      if (typeof input.data !== "string") {
        const ctx = this._getOrReturnCtx(input);
        const expectedValues = this._def.values;
        addIssueToContext(ctx, {
          expected: util.joinValues(expectedValues),
          received: ctx.parsedType,
          code: ZodIssueCode.invalid_type
        });
        return INVALID;
      }
      if (!this._cache) {
        this._cache = new Set(this._def.values);
      }
      if (!this._cache.has(input.data)) {
        const ctx = this._getOrReturnCtx(input);
        const expectedValues = this._def.values;
        addIssueToContext(ctx, {
          received: ctx.data,
          code: ZodIssueCode.invalid_enum_value,
          options: expectedValues
        });
        return INVALID;
      }
      return OK(input.data);
    }
    get options() {
      return this._def.values;
    }
    get enum() {
      const enumValues = {};
      for (const val of this._def.values) {
        enumValues[val] = val;
      }
      return enumValues;
    }
    get Values() {
      const enumValues = {};
      for (const val of this._def.values) {
        enumValues[val] = val;
      }
      return enumValues;
    }
    get Enum() {
      const enumValues = {};
      for (const val of this._def.values) {
        enumValues[val] = val;
      }
      return enumValues;
    }
    extract(values, newDef = this._def) {
      return _ZodEnum.create(values, {
        ...this._def,
        ...newDef
      });
    }
    exclude(values, newDef = this._def) {
      return _ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
        ...this._def,
        ...newDef
      });
    }
  };
  ZodEnum.create = createZodEnum;
  var ZodNativeEnum = class extends ZodType {
    _parse(input) {
      const nativeEnumValues = util.getValidEnumValues(this._def.values);
      const ctx = this._getOrReturnCtx(input);
      if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
        const expectedValues = util.objectValues(nativeEnumValues);
        addIssueToContext(ctx, {
          expected: util.joinValues(expectedValues),
          received: ctx.parsedType,
          code: ZodIssueCode.invalid_type
        });
        return INVALID;
      }
      if (!this._cache) {
        this._cache = new Set(util.getValidEnumValues(this._def.values));
      }
      if (!this._cache.has(input.data)) {
        const expectedValues = util.objectValues(nativeEnumValues);
        addIssueToContext(ctx, {
          received: ctx.data,
          code: ZodIssueCode.invalid_enum_value,
          options: expectedValues
        });
        return INVALID;
      }
      return OK(input.data);
    }
    get enum() {
      return this._def.values;
    }
  };
  ZodNativeEnum.create = (values, params) => {
    return new ZodNativeEnum({
      values,
      typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
      ...processCreateParams(params)
    });
  };
  var ZodPromise = class extends ZodType {
    unwrap() {
      return this._def.type;
    }
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.promise,
          received: ctx.parsedType
        });
        return INVALID;
      }
      const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
      return OK(promisified.then((data) => {
        return this._def.type.parseAsync(data, {
          path: ctx.path,
          errorMap: ctx.common.contextualErrorMap
        });
      }));
    }
  };
  ZodPromise.create = (schema, params) => {
    return new ZodPromise({
      type: schema,
      typeName: ZodFirstPartyTypeKind.ZodPromise,
      ...processCreateParams(params)
    });
  };
  var ZodEffects = class extends ZodType {
    innerType() {
      return this._def.schema;
    }
    sourceType() {
      return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
    }
    _parse(input) {
      const { status, ctx } = this._processInputParams(input);
      const effect = this._def.effect || null;
      const checkCtx = {
        addIssue: (arg) => {
          addIssueToContext(ctx, arg);
          if (arg.fatal) {
            status.abort();
          } else {
            status.dirty();
          }
        },
        get path() {
          return ctx.path;
        }
      };
      checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
      if (effect.type === "preprocess") {
        const processed = effect.transform(ctx.data, checkCtx);
        if (ctx.common.async) {
          return Promise.resolve(processed).then(async (processed2) => {
            if (status.value === "aborted")
              return INVALID;
            const result = await this._def.schema._parseAsync({
              data: processed2,
              path: ctx.path,
              parent: ctx
            });
            if (result.status === "aborted")
              return INVALID;
            if (result.status === "dirty")
              return DIRTY(result.value);
            if (status.value === "dirty")
              return DIRTY(result.value);
            return result;
          });
        } else {
          if (status.value === "aborted")
            return INVALID;
          const result = this._def.schema._parseSync({
            data: processed,
            path: ctx.path,
            parent: ctx
          });
          if (result.status === "aborted")
            return INVALID;
          if (result.status === "dirty")
            return DIRTY(result.value);
          if (status.value === "dirty")
            return DIRTY(result.value);
          return result;
        }
      }
      if (effect.type === "refinement") {
        const executeRefinement = (acc) => {
          const result = effect.refinement(acc, checkCtx);
          if (ctx.common.async) {
            return Promise.resolve(result);
          }
          if (result instanceof Promise) {
            throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
          }
          return acc;
        };
        if (ctx.common.async === false) {
          const inner = this._def.schema._parseSync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          });
          if (inner.status === "aborted")
            return INVALID;
          if (inner.status === "dirty")
            status.dirty();
          executeRefinement(inner.value);
          return { status: status.value, value: inner.value };
        } else {
          return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
            if (inner.status === "aborted")
              return INVALID;
            if (inner.status === "dirty")
              status.dirty();
            return executeRefinement(inner.value).then(() => {
              return { status: status.value, value: inner.value };
            });
          });
        }
      }
      if (effect.type === "transform") {
        if (ctx.common.async === false) {
          const base = this._def.schema._parseSync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          });
          if (!isValid(base))
            return INVALID;
          const result = effect.transform(base.value, checkCtx);
          if (result instanceof Promise) {
            throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
          }
          return { status: status.value, value: result };
        } else {
          return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
            if (!isValid(base))
              return INVALID;
            return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({
              status: status.value,
              value: result
            }));
          });
        }
      }
      util.assertNever(effect);
    }
  };
  ZodEffects.create = (schema, effect, params) => {
    return new ZodEffects({
      schema,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect,
      ...processCreateParams(params)
    });
  };
  ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
    return new ZodEffects({
      schema,
      effect: { type: "preprocess", transform: preprocess },
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      ...processCreateParams(params)
    });
  };
  var ZodOptional = class extends ZodType {
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType === ZodParsedType.undefined) {
        return OK(void 0);
      }
      return this._def.innerType._parse(input);
    }
    unwrap() {
      return this._def.innerType;
    }
  };
  ZodOptional.create = (type, params) => {
    return new ZodOptional({
      innerType: type,
      typeName: ZodFirstPartyTypeKind.ZodOptional,
      ...processCreateParams(params)
    });
  };
  var ZodNullable = class extends ZodType {
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType === ZodParsedType.null) {
        return OK(null);
      }
      return this._def.innerType._parse(input);
    }
    unwrap() {
      return this._def.innerType;
    }
  };
  ZodNullable.create = (type, params) => {
    return new ZodNullable({
      innerType: type,
      typeName: ZodFirstPartyTypeKind.ZodNullable,
      ...processCreateParams(params)
    });
  };
  var ZodDefault = class extends ZodType {
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      let data = ctx.data;
      if (ctx.parsedType === ZodParsedType.undefined) {
        data = this._def.defaultValue();
      }
      return this._def.innerType._parse({
        data,
        path: ctx.path,
        parent: ctx
      });
    }
    removeDefault() {
      return this._def.innerType;
    }
  };
  ZodDefault.create = (type, params) => {
    return new ZodDefault({
      innerType: type,
      typeName: ZodFirstPartyTypeKind.ZodDefault,
      defaultValue: typeof params.default === "function" ? params.default : () => params.default,
      ...processCreateParams(params)
    });
  };
  var ZodCatch = class extends ZodType {
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      const newCtx = {
        ...ctx,
        common: {
          ...ctx.common,
          issues: []
        }
      };
      const result = this._def.innerType._parse({
        data: newCtx.data,
        path: newCtx.path,
        parent: {
          ...newCtx
        }
      });
      if (isAsync(result)) {
        return result.then((result2) => {
          return {
            status: "valid",
            value: result2.status === "valid" ? result2.value : this._def.catchValue({
              get error() {
                return new ZodError(newCtx.common.issues);
              },
              input: newCtx.data
            })
          };
        });
      } else {
        return {
          status: "valid",
          value: result.status === "valid" ? result.value : this._def.catchValue({
            get error() {
              return new ZodError(newCtx.common.issues);
            },
            input: newCtx.data
          })
        };
      }
    }
    removeCatch() {
      return this._def.innerType;
    }
  };
  ZodCatch.create = (type, params) => {
    return new ZodCatch({
      innerType: type,
      typeName: ZodFirstPartyTypeKind.ZodCatch,
      catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
      ...processCreateParams(params)
    });
  };
  var ZodNaN = class extends ZodType {
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.nan) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.nan,
          received: ctx.parsedType
        });
        return INVALID;
      }
      return { status: "valid", value: input.data };
    }
  };
  ZodNaN.create = (params) => {
    return new ZodNaN({
      typeName: ZodFirstPartyTypeKind.ZodNaN,
      ...processCreateParams(params)
    });
  };
  var BRAND = /* @__PURE__ */ Symbol("zod_brand");
  var ZodBranded = class extends ZodType {
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      const data = ctx.data;
      return this._def.type._parse({
        data,
        path: ctx.path,
        parent: ctx
      });
    }
    unwrap() {
      return this._def.type;
    }
  };
  var ZodPipeline = class _ZodPipeline extends ZodType {
    _parse(input) {
      const { status, ctx } = this._processInputParams(input);
      if (ctx.common.async) {
        const handleAsync = async () => {
          const inResult = await this._def.in._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          });
          if (inResult.status === "aborted")
            return INVALID;
          if (inResult.status === "dirty") {
            status.dirty();
            return DIRTY(inResult.value);
          } else {
            return this._def.out._parseAsync({
              data: inResult.value,
              path: ctx.path,
              parent: ctx
            });
          }
        };
        return handleAsync();
      } else {
        const inResult = this._def.in._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inResult.status === "aborted")
          return INVALID;
        if (inResult.status === "dirty") {
          status.dirty();
          return {
            status: "dirty",
            value: inResult.value
          };
        } else {
          return this._def.out._parseSync({
            data: inResult.value,
            path: ctx.path,
            parent: ctx
          });
        }
      }
    }
    static create(a, b) {
      return new _ZodPipeline({
        in: a,
        out: b,
        typeName: ZodFirstPartyTypeKind.ZodPipeline
      });
    }
  };
  var ZodReadonly = class extends ZodType {
    _parse(input) {
      const result = this._def.innerType._parse(input);
      const freeze = (data) => {
        if (isValid(data)) {
          data.value = Object.freeze(data.value);
        }
        return data;
      };
      return isAsync(result) ? result.then((data) => freeze(data)) : freeze(result);
    }
    unwrap() {
      return this._def.innerType;
    }
  };
  ZodReadonly.create = (type, params) => {
    return new ZodReadonly({
      innerType: type,
      typeName: ZodFirstPartyTypeKind.ZodReadonly,
      ...processCreateParams(params)
    });
  };
  function cleanParams(params, data) {
    const p = typeof params === "function" ? params(data) : typeof params === "string" ? { message: params } : params;
    const p2 = typeof p === "string" ? { message: p } : p;
    return p2;
  }
  function custom(check, _params = {}, fatal) {
    if (check)
      return ZodAny.create().superRefine((data, ctx) => {
        const r = check(data);
        if (r instanceof Promise) {
          return r.then((r2) => {
            if (!r2) {
              const params = cleanParams(_params, data);
              const _fatal = params.fatal ?? fatal ?? true;
              ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
            }
          });
        }
        if (!r) {
          const params = cleanParams(_params, data);
          const _fatal = params.fatal ?? fatal ?? true;
          ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
        }
        return;
      });
    return ZodAny.create();
  }
  var late = {
    object: ZodObject.lazycreate
  };
  var ZodFirstPartyTypeKind;
  (function(ZodFirstPartyTypeKind2) {
    ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
    ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
    ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
    ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
    ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
    ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
    ZodFirstPartyTypeKind2["ZodSymbol"] = "ZodSymbol";
    ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
    ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
    ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
    ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
    ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
    ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
    ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
    ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
    ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
    ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
    ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
    ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
    ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
    ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
    ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
    ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
    ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
    ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
    ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
    ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
    ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
    ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
    ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
    ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
    ZodFirstPartyTypeKind2["ZodCatch"] = "ZodCatch";
    ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
    ZodFirstPartyTypeKind2["ZodBranded"] = "ZodBranded";
    ZodFirstPartyTypeKind2["ZodPipeline"] = "ZodPipeline";
    ZodFirstPartyTypeKind2["ZodReadonly"] = "ZodReadonly";
  })(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
  var instanceOfType = (cls, params = {
    message: `Input not instance of ${cls.name}`
  }) => custom((data) => data instanceof cls, params);
  var stringType = ZodString.create;
  var numberType = ZodNumber.create;
  var nanType = ZodNaN.create;
  var bigIntType = ZodBigInt.create;
  var booleanType = ZodBoolean.create;
  var dateType = ZodDate.create;
  var symbolType = ZodSymbol.create;
  var undefinedType = ZodUndefined.create;
  var nullType = ZodNull.create;
  var anyType = ZodAny.create;
  var unknownType = ZodUnknown.create;
  var neverType = ZodNever.create;
  var voidType = ZodVoid.create;
  var arrayType = ZodArray.create;
  var objectType = ZodObject.create;
  var strictObjectType = ZodObject.strictCreate;
  var unionType = ZodUnion.create;
  var discriminatedUnionType = ZodDiscriminatedUnion.create;
  var intersectionType = ZodIntersection.create;
  var tupleType = ZodTuple.create;
  var recordType = ZodRecord.create;
  var mapType = ZodMap.create;
  var setType = ZodSet.create;
  var functionType = ZodFunction.create;
  var lazyType = ZodLazy.create;
  var literalType = ZodLiteral.create;
  var enumType = ZodEnum.create;
  var nativeEnumType = ZodNativeEnum.create;
  var promiseType = ZodPromise.create;
  var effectsType = ZodEffects.create;
  var optionalType = ZodOptional.create;
  var nullableType = ZodNullable.create;
  var preprocessType = ZodEffects.createWithPreprocess;
  var pipelineType = ZodPipeline.create;
  var ostring = () => stringType().optional();
  var onumber = () => numberType().optional();
  var oboolean = () => booleanType().optional();
  var coerce = {
    string: ((arg) => ZodString.create({ ...arg, coerce: true })),
    number: ((arg) => ZodNumber.create({ ...arg, coerce: true })),
    boolean: ((arg) => ZodBoolean.create({
      ...arg,
      coerce: true
    })),
    bigint: ((arg) => ZodBigInt.create({ ...arg, coerce: true })),
    date: ((arg) => ZodDate.create({ ...arg, coerce: true }))
  };
  var NEVER = INVALID;

  // ../shared/src/team.ts
  var TeamSchema = external_exports.object({
    id: external_exports.string().min(1),
    name: external_exports.string().min(1),
    short: external_exports.string().min(1).max(5),
    color: external_exports.string().regex(/^#[0-9a-fA-F]{6}$/),
    logoAssetId: external_exports.string().optional()
  });
  var PlayerSchema = external_exports.object({
    id: external_exports.string().min(1),
    name: external_exports.string().min(1),
    role: external_exports.enum(["batter", "bowler", "allrounder", "wk"]),
    teamId: external_exports.string().min(1),
    isCaptain: external_exports.boolean().default(false),
    isWk: external_exports.boolean().default(false),
    photoAssetId: external_exports.string().optional()
  });

  // ../shared/src/teams.ts
  var T = (code, name, aliases, colors, kind = "international") => ({ code, name, aliases, colors, kind });
  var TEAM_REGISTRY = [
    // ---- Full members -------------------------------------------------------------------------
    T("rsa", "South Africa", ["rsa", "south africa", "southafrica", "sa", "proteas"], ["#007A4D", "#FFB81C"]),
    T("aus", "Australia", ["aus", "australia", "au", "baggy green"], ["#00843D", "#FFCD00"]),
    T("ind", "India", ["ind", "india", "team india", "blue tigers"], ["#1B4B99", "#E7A61C"]),
    T("pak", "Pakistan", ["pak", "pakistan", "green shirts"], ["#01411C", "#FFFFFF"]),
    T("eng", "England", ["eng", "england", "alion"], ["#0C2340", "#C8102E"]),
    T("nz", "new zealand", ["nz", "new zealand", "black caps"], ["#000000", "#FFB612"]),
    T("wi", "west indies", ["wi", "west indies", "westindies", "california"], ["#7A003C", "#FFC72C"]),
    T("sl", "Sri Lanka", ["sl", "sri lanka", "srilanka", "srl", "lanka"], ["#00534E", "#FFBE29"]),
    T("ban", "Bangladesh", ["ban", "bangladesh", "tigers"], ["#006A4E", "#F42A41"]),
    T("afg", "Afghanistan", ["afg", "afghanistan"], ["#000000", "#DA121A"]),
    T("ire", "Ireland", ["ire", "irland", "ireland", "eire"], ["#015744", "#F0C84A"]),
    T("zim", "Zimbabwe", ["zim", "zimbabwe"], ["#000000", "#F5A623"]),
    // ---- Other international sides ------------------------------------------------------------
    T("ned", "Netherlands", ["ned", "netherlands", "holland", "net"], ["#FF6F00", "#21468B"]),
    T("sco", "Scotland", ["sco", "scotland"], ["#003078", "#D1A33E"]),
    T("oma", "Oman", ["oma", "oman"], ["#9E1B32", "#FFFFFF"]),
    T("uae", "United Arab Emirates", ["uae", "united arab emirates", "emirates"], ["#00732F", "#FFFFFF"]),
    T("can", "Canada", ["can", "canada"], ["#D80621", "#FFFFFF"]),
    T("usa", "USA", ["usa", "united states", "united states of america"], ["#0A3161", "#B31942"]),
    T("png", "Papua New Guinea", ["png", "papua new guinea"], ["#000000", "#CE1126"]),
    T("nep", "Nepal", ["nep", "nepal"], ["#DC143C", "#003893"]),
    T("hk", "Hong Kong", ["hk", "hong kong", "hongkong"], ["#C41E3A", "#FFFFFF"]),
    T("mas", "Malaysia", ["mas", "malaysia"], ["#010066", "#CE1126"]),
    T("sgp", "Singapore", ["sgp", "singapore"], ["#EF3340", "#FFFFFF"]),
    T("tha", "Thailand", ["tha", "thailand"], ["#002868", "#F4F5F8"]),
    T("nam", "Namibia", ["nam", "namibia"], ["#003580", "#D0A520"]),
    T("nga", "Nigeria", ["nga", "nigeria"], ["#008751", "#FFFFFF"]),
    T("ken", "Kenya", ["ken", "kenya"], ["#000000", "#BB0000"]),
    T("uga", "Uganda", ["uga", "uganda"], ["#000000", "#FCDC04"]),
    T("tan", "Tanzania", ["tan", "tanzania"], ["#1EB53A", "#FCD116"]),
    T("rwa", "Rwanda", ["rwa", "rwanda"], ["#00A1DE", "#FAD201"]),
    T("ita", "Italy", ["ita", "italy"], ["#0066CC", "#FFFFFF"]),
    T("ger", "Germany", ["ger", "germany"], ["#000000", "#DD0000"]),
    T("fra", "France", ["fra", "france"], ["#002395", "#ED2939"]),
    T("esp", "Spain", ["esp", "spain"], ["#AA151B", "#F1BF00"]),
    T("por", "Portugal", ["por", "portugal"], ["#006600", "#FF0000"]),
    T("den", "Denmark", ["den", "denmark"], ["#C60C30", "#FFFFFF"]),
    T("swe", "Sweden", ["swe", "sweden"], ["#006AA7", "#FECC02"]),
    T("nor", "Norway", ["nor", "norway"], ["#BA0C2F", "#FFFFFF"]),
    T("fin", "Finland", ["fin", "finland"], ["#003580", "#FFFFFF"]),
    T("sui", "Switzerland", ["sui", "switzerland"], ["#DA291C", "#FFFFFF"]),
    T("aut", "Austria", ["aut", "austria"], ["#ED2939", "#FFFFFF"]),
    T("bel", "Belgium", ["bel", "belgium"], ["#FDDA24", "#000000"]),
    T("nzl", "Netherlands Women", ["nzw"], ["#FF6F00", "#21468B"]),
    // ---- IPL ----------------------------------------------------------------------------------
    T("csk", "Chennai Super Kings", ["csk", "chennai super kings", "super kings", "chennai"], ["#F9CD05", "#005DB7"], "franchise"),
    T("mi", "Mumbai Indians", ["mi", "mumbai indians", "mumbai"], ["#041E42", "#D1AB3E"], "franchise"),
    T("rcb", "Royal Challengers Bengaluru", ["rcb", "royal challengers", "bengaluru", "bangalore"], ["#D5152A", "#000000"], "franchise"),
    T("kkr", "Kolkata Knight Riders", ["kkr", "kolkata knight riders", "kolkata"], ["#3A225D", "#E4AA31"], "franchise"),
    T("dc", "Delhi Capitals", ["dc", "delhi capitals", "delhi"], ["#17449B", "#EF1B23"], "franchise"),
    T("srh", "Sunrisers Hyderabad", ["srh", "sunrisers", "hyderabad"], ["#F26522", "#000000"], "franchise"),
    T("rr", "Rajasthan Royals", ["rr", "rajasthan royals", "rajasthan", "rjr"], ["#EA1A85", "#254AA5"], "franchise"),
    T("pbks", "Punjab Kings", ["pbks", "kxip", "punjab kings", "kings xi", "chandigarh"], ["#DD1F2D", "#A7A9AC"], "franchise"),
    T("gt", "Gujarat Titans", ["gt", "gujarat titans", "gujarat"], ["#1B2133", "#E2C47F"], "franchise"),
    T("lsg", "Lucknow Super Giants", ["lsg", "lucknow super giants", "lucknow"], ["#0A52A0", "#E2C47F"], "franchise"),
    // ---- BBL ----------------------------------------------------------------------------------
    T("ads", "Adelaide Strikers", ["ads", "adelaide strikers", "adelaide"], ["#1CE7DB", "#041E42"], "franchise"),
    T("brh", "Brisbane Heat", ["brh", "brisbane heat", "brisbane"], ["#F57D1F", "#1A1A1A"], "franchise"),
    T("hbh", "Hobart Hurricanes", ["hbh", "hobart hurricanes", "hobart"], ["#1E90FF", "#0B1F3A"], "franchise"),
    T("mlr", "Melbourne Renegades", ["mlr", "melbourne renegades", "renegades"], ["#0BB2E8", "#1A1A1A"], "franchise"),
    T("mls", "Melbourne Stars", ["mls", "melbourne stars", "stars"], ["#00A651", "#1A1A1A"], "franchise"),
    T("prs", "Perth Scorchers", ["prs", "perth scorchers", "perth"], ["#EE1C25", "#1A1A1A"], "franchise"),
    T("sys", "Sydney Sixers", ["sys", "sydney sixers", "sixers"], ["#00838F", "#FFBB00"], "franchise"),
    T("syt", "Sydney Thunder", ["syt", "sydney thunder", "thunder"], ["#004B8D", "#FFD200"], "franchise"),
    // ---- PSL ----------------------------------------------------------------------------------
    T("isu", "Islamabad United", ["isu", "islamabad united"], ["#C5272E", "#1A1A1A"], "franchise"),
    T("kk", "Karachi Kings", ["kk", "krk", "karachi kings", "karachi"], ["#1D3461", "#E7A33E"], "franchise"),
    T("lq", "Lahore Qalandars", ["lq", "lhq", "lahore qalandars", "lahore"], ["#00549A", "#F5A623"], "franchise"),
    T("pz", "Peshawar Zalmi", ["pz", "psz", "peshawar zalmi", "peshawar"], ["#EE1C25", "#F5A623"], "franchise"),
    T("qg", "Quetta Gladiators", ["qg", "qtg", "quetta gladiators", "quetta"], ["#6A2C91", "#F5A623"], "franchise"),
    T("ms", "Multan Sultans", ["ms", "multan sultans", "multan"], ["#F5A623", "#0B4D3C"], "franchise")
  ];
  var clean = (s) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();
  var byCode = /* @__PURE__ */ new Map();
  var byAlias = /* @__PURE__ */ new Map();
  for (const t of TEAM_REGISTRY) {
    byCode.set(t.code, t);
    for (const a of [t.code, t.name, ...t.aliases]) {
      const key = clean(a);
      if (key && !byAlias.has(key)) byAlias.set(key, t);
    }
  }

  // ../shared/src/ball.ts
  var ExtraSchema = external_exports.object({
    type: external_exports.enum(["wide", "noball", "bye", "legbye", "penalty"]),
    runs: external_exports.number().int().min(0)
  });
  var WicketSchema = external_exports.object({
    kind: external_exports.enum([
      "bowled",
      "caught",
      "lbw",
      "runout",
      "stumped",
      "hitwicket",
      "retired",
      "obstructing",
      "other"
    ]),
    playerOutId: external_exports.string().min(1)
  });
  var NO_RUN_WICKETS = ["bowled", "lbw", "stumped", "hitwicket"];
  var BallEventSchema = external_exports.object({
    over: external_exports.number().int().min(0),
    ball: external_exports.number().int().min(1),
    /** Runs off the bat. Above 6 only with overthrows; extras are a separate field. */
    runs: external_exports.number().int().min(0).max(7),
    extras: ExtraSchema.optional(),
    wicket: WicketSchema.optional(),
    batterId: external_exports.string().min(1),
    bowlerId: external_exports.string().min(1)
  }).refine(
    (b) => !(b.wicket && NO_RUN_WICKETS.includes(b.wicket.kind) && b.runs > 0),
    "a batter out bowled/lbw/stumped/hit wicket cannot be credited runs"
  );

  // ../shared/src/match.ts
  var MatchFormatSchema = external_exports.enum(["T20", "ODI", "TEST", "OTHER"]);
  var MatchStatusSchema = external_exports.enum(["pre", "live", "break", "innings_break", "result"]);
  var ScoreSchema = external_exports.object({
    runs: external_exports.number().int().min(0),
    wkts: external_exports.number().int().min(0).max(10),
    overs: external_exports.number().int().min(0),
    balls: external_exports.number().int().min(0).max(5)
  });
  var InningsSchema = external_exports.object({
    number: external_exports.number().int().min(1),
    battingTeamId: external_exports.string().min(1),
    score: ScoreSchema,
    declared: external_exports.boolean().default(false),
    allOut: external_exports.boolean().default(false)
  });
  var BatterSchema = external_exports.object({
    playerId: external_exports.string().min(1),
    name: external_exports.string().min(1),
    runs: external_exports.number().int().min(0),
    balls: external_exports.number().int().min(0),
    fours: external_exports.number().int().min(0),
    sixes: external_exports.number().int().min(0),
    onStrike: external_exports.boolean()
  });
  var BowlerSchema = external_exports.object({
    playerId: external_exports.string().min(1),
    name: external_exports.string().min(1),
    overs: external_exports.number().int().min(0),
    balls: external_exports.number().int().min(0).max(5),
    maidens: external_exports.number().int().min(0),
    runs: external_exports.number().int().min(0),
    wkts: external_exports.number().int().min(0).max(10)
  });
  var BattingFigureSchema = external_exports.object({
    playerId: external_exports.string().min(1),
    name: external_exports.string().min(1),
    runs: external_exports.number().int().min(0),
    balls: external_exports.number().int().min(0),
    fours: external_exports.number().int().min(0),
    sixes: external_exports.number().int().min(0),
    innings: external_exports.number().int().min(1)
  });
  var BowlingFigureSchema = external_exports.object({
    playerId: external_exports.string().min(1),
    name: external_exports.string().min(1),
    overs: external_exports.number().int().min(0),
    balls: external_exports.number().int().min(0).max(5),
    maidens: external_exports.number().int().min(0),
    runs: external_exports.number().int().min(0),
    wkts: external_exports.number().int().min(0).max(10),
    innings: external_exports.number().int().min(1)
  });
  var TossSchema = external_exports.object({
    winnerTeamId: external_exports.string().min(1),
    decision: external_exports.enum(["bat", "bowl"])
  });
  var MatchStateSchema = external_exports.object({
    id: external_exports.string().min(1),
    title: external_exports.string().min(1),
    format: MatchFormatSchema,
    status: MatchStatusSchema,
    venue: external_exports.string().optional(),
    toss: TossSchema.optional(),
    teams: external_exports.tuple([TeamSchema, TeamSchema]),
    innings: external_exports.array(InningsSchema),
    /** 1-based innings number; 0 before the match starts. */
    currentInnings: external_exports.number().int().min(0),
    battingTeamId: external_exports.string().min(1),
    score: ScoreSchema,
    target: external_exports.number().int().positive().optional(),
    batters: external_exports.tuple([BatterSchema, BatterSchema]),
    bowler: BowlerSchema,
    lastBalls: external_exports.array(BallEventSchema).max(6),
    thisOver: external_exports.array(BallEventSchema),
    partnership: external_exports.object({ runs: external_exports.number().int().min(0), balls: external_exports.number().int().min(0) }),
    crr: external_exports.number().min(0),
    rrr: external_exports.number().min(0).optional(),
    projected: external_exports.number().int().min(0).optional(),
    /** Projected total if the scoring rate rises by 2 an over. */
    projectedPlus2: external_exports.number().int().min(0).optional(),
    /** Estimate only. teamA/teamB follow `teams` order and are the two halves of one number. Absent for Tests (see engine docs). */
    winProb: external_exports.object({ teamA: external_exports.number().min(0).max(1), teamB: external_exports.number().min(0).max(1) }).refine((p) => Math.abs(p.teamA + p.teamB - 1) <= 2e-3, "win probabilities must sum to 1").optional(),
    wicketsLeft: external_exports.number().int().min(0).max(10).optional(),
    /** Legal balls remaining in a limited-overs innings. */
    ballsLeft: external_exports.number().int().min(0).optional(),
    runsNeeded: external_exports.number().int().min(0).optional(),
    /** Runs ahead (+) or behind (-) in a Test. */
    lead: external_exports.number().int().optional(),
    powerplay: external_exports.object({
      runs: external_exports.number().int().min(0),
      wkts: external_exports.number().int().min(0).max(10),
      complete: external_exports.boolean()
    }).optional(),
    /** Share of observed balls that were dots (0-100). Based on `ballsObserved`, not all balls. */
    dotBallPct: external_exports.number().min(0).max(100).optional(),
    boundaries: external_exports.object({ fours: external_exports.number().int().min(0), sixes: external_exports.number().int().min(0) }).optional(),
    ballsObserved: external_exports.number().int().min(0).optional(),
    /**
     * The feed only publishes the pair at the crease and the bowler running in, so these are the
     * best figures seen anywhere in the match. Absent when the snapshots carried no player rows.
     */
    topBatters: external_exports.array(BattingFigureSchema).optional(),
    topBowlers: external_exports.array(BowlingFigureSchema).optional(),
    /** Overs per innings when it differs from the format default (e.g. a 10-over match). */
    oversLimit: external_exports.number().int().positive().optional(),
    day: external_exports.number().int().min(1).max(5).optional(),
    session: external_exports.enum(["morning", "afternoon", "evening"]).optional(),
    result: external_exports.string().optional(),
    updatedAt: external_exports.string().datetime()
  });
  var oversDecimal = (s) => s.overs + s.balls / 6;
  var runRate = (s) => {
    const o = oversDecimal(s);
    return o === 0 ? 0 : Math.round(s.runs / o * 100) / 100;
  };

  // ../shared/src/event.ts
  var EngineEventTypeSchema = external_exports.enum([
    "FOUR",
    "SIX",
    "WICKET",
    "FIFTY",
    "HUNDRED",
    "OVER_END",
    "INNINGS_END",
    "SESSION_END",
    "DAY_END",
    "NEW_BATTER",
    "MILESTONE",
    "DRS"
  ]);
  var EngineEventSchema = external_exports.object({
    /** Deterministic id (match + innings + over + ball + type) so detection is idempotent. */
    id: external_exports.string().min(1),
    matchId: external_exports.string().min(1),
    type: EngineEventTypeSchema,
    at: external_exports.string().datetime(),
    payload: external_exports.record(external_exports.string(), external_exports.unknown()).default({})
  });

  // ../shared/src/look.ts
  var hex = external_exports.string().regex(/^#[0-9a-fA-F]{6}$/);
  var LookSchema = external_exports.object({
    id: external_exports.string().min(1),
    name: external_exports.string().min(1),
    plan: external_exports.enum(["free", "pro"]).default("free"),
    tokens: external_exports.object({
      colors: external_exports.record(external_exports.string(), hex),
      gradients: external_exports.record(external_exports.string(), external_exports.string()).default({}),
      fonts: external_exports.object({ heading: external_exports.string(), body: external_exports.string(), numbers: external_exports.string() }),
      radii: external_exports.record(external_exports.string(), external_exports.number().min(0)).default({}),
      shadows: external_exports.record(external_exports.string(), external_exports.string()).default({}),
      scoreBarShape: external_exports.enum([
        "flat",
        "pill",
        "glass",
        "notched",
        "slanted",
        "line",
        "mono",
        "arrow",
        "floating"
      ])
    }),
    layoutVariant: external_exports.object({
      scorePosition: external_exports.enum(["top", "bottom"]),
      playerCardStyle: external_exports.enum(["cutout", "badge", "badge-right", "round-badge", "mirrored"]),
      boundaryStyle: external_exports.string().min(1)
    }),
    motion: external_exports.object({
      entrance: external_exports.enum([
        "slide",
        "fade",
        "zoom",
        "flip",
        "blur",
        "curtain",
        "iris",
        "skew",
        "rise",
        "glitch",
        "blinds",
        "unfold",
        "pop",
        "drop",
        "swing",
        "zoom-out",
        "slide-right",
        "stretch",
        "diamond",
        "spin"
      ]),
      easing: external_exports.string().default("power2.out"),
      durationMs: external_exports.number().int().min(50).max(3e3).default(500)
    })
  });

  // ../shared/src/looks-data/aqua-mono.json
  var aqua_mono_default = {
    id: "aqua-mono",
    name: "Aqua Mono",
    plan: "pro",
    tokens: {
      colors: {
        bg: "#06161A",
        surface: "#0B2328",
        accent: "#3FE0E0",
        accent2: "#A5F3F3",
        warn: "#FFD166",
        text: "#E6FFFF"
      },
      gradients: {
        accent: "linear-gradient(90deg, #3FE0E0, #A5F3F3)"
      },
      fonts: {
        heading: "Space Grotesk",
        body: "Inter",
        numbers: "Barlow Condensed"
      },
      radii: {
        card: 0,
        chip: 0
      },
      shadows: {
        card: "none"
      },
      scoreBarShape: "mono"
    },
    layoutVariant: {
      scorePosition: "top",
      playerCardStyle: "badge",
      boundaryStyle: "corner-tag"
    },
    motion: {
      entrance: "flip",
      easing: "power2.out",
      durationMs: 520
    }
  };

  // ../shared/src/looks-data/coral-dusk.json
  var coral_dusk_default = {
    id: "coral-dusk",
    name: "Coral Dusk",
    plan: "free",
    tokens: {
      colors: {
        bg: "#1B1214",
        surface: "#2A1B1E",
        accent: "#FF6B57",
        accent2: "#FFB020",
        warn: "#FFB020",
        text: "#FFF1EE"
      },
      gradients: {
        accent: "linear-gradient(90deg, #FF6B57, #FFB020)"
      },
      fonts: {
        heading: "Space Grotesk",
        body: "Inter",
        numbers: "Barlow Condensed"
      },
      radii: {
        card: 28,
        chip: 20
      },
      shadows: {
        card: "0 10px 28px rgba(0,0,0,0.4)"
      },
      scoreBarShape: "pill"
    },
    layoutVariant: {
      scorePosition: "bottom",
      playerCardStyle: "badge",
      boundaryStyle: "burst"
    },
    motion: {
      entrance: "slide",
      easing: "power3.out",
      durationMs: 500
    }
  };

  // ../shared/src/looks-data/ember.json
  var ember_default = {
    id: "ember",
    name: "Ember",
    plan: "pro",
    tokens: {
      colors: {
        bg: "#1A0E0A",
        surface: "#2A1710",
        accent: "#FF7A1A",
        accent2: "#FFC24D",
        warn: "#FFC24D",
        text: "#FFF0E3"
      },
      gradients: {
        accent: "linear-gradient(90deg, #FF7A1A, #FFC24D)"
      },
      fonts: {
        heading: "Space Grotesk",
        body: "Inter",
        numbers: "Barlow Condensed"
      },
      radii: {
        card: 6,
        chip: 4
      },
      shadows: {
        card: "0 10px 30px rgba(255,100,20,0.25)"
      },
      scoreBarShape: "arrow"
    },
    layoutVariant: {
      scorePosition: "bottom",
      playerCardStyle: "cutout",
      boundaryStyle: "spark"
    },
    motion: {
      entrance: "skew",
      easing: "expo.out",
      durationMs: 480
    }
  };

  // ../shared/src/looks-data/graphite-teal.json
  var graphite_teal_default = {
    id: "graphite-teal",
    name: "Graphite Teal",
    plan: "free",
    tokens: {
      colors: {
        bg: "#0E1116",
        surface: "#161B22",
        accent: "#19D3C5",
        accent2: "#FF6B57",
        warn: "#FFB020",
        text: "#E6EDF3"
      },
      gradients: {
        accent: "linear-gradient(90deg, #19D3C5, #FF6B57)"
      },
      fonts: {
        heading: "Space Grotesk",
        body: "Inter",
        numbers: "Barlow Condensed"
      },
      radii: {
        card: 12,
        chip: 8
      },
      shadows: {
        card: "0 8px 24px rgba(0,0,0,0.35)"
      },
      scoreBarShape: "flat"
    },
    layoutVariant: {
      scorePosition: "top",
      playerCardStyle: "badge",
      boundaryStyle: "edge-flash"
    },
    motion: {
      entrance: "fade",
      easing: "power2.out",
      durationMs: 450
    }
  };

  // ../shared/src/looks-data/ink-gold.json
  var ink_gold_default = {
    id: "ink-gold",
    name: "Ink & Gold",
    plan: "pro",
    tokens: {
      colors: {
        bg: "#0A0A0C",
        surface: "#141418",
        accent: "#D4AF37",
        accent2: "#F5E6A8",
        warn: "#E8C547",
        text: "#F7F2E1"
      },
      gradients: {
        accent: "linear-gradient(90deg, #D4AF37, #F5E6A8)"
      },
      fonts: {
        heading: "Space Grotesk",
        body: "Inter",
        numbers: "Barlow Condensed"
      },
      radii: {
        card: 2,
        chip: 0
      },
      shadows: {
        card: "0 0 0 1px rgba(212,175,55,0.35)"
      },
      scoreBarShape: "line"
    },
    layoutVariant: {
      scorePosition: "bottom",
      playerCardStyle: "cutout",
      boundaryStyle: "gold-flare"
    },
    motion: {
      entrance: "iris",
      easing: "power2.inOut",
      durationMs: 700
    }
  };

  // ../shared/src/looks-data/midnight-glass.json
  var midnight_glass_default = {
    id: "midnight-glass",
    name: "Midnight Glass",
    plan: "pro",
    tokens: {
      colors: {
        bg: "#0A0F1F",
        surface: "#121A33",
        accent: "#7AA2FF",
        accent2: "#B794F6",
        warn: "#FFD166",
        text: "#EAF0FF"
      },
      gradients: {
        accent: "linear-gradient(90deg, #7AA2FF, #B794F6)"
      },
      fonts: {
        heading: "Space Grotesk",
        body: "Inter",
        numbers: "Barlow Condensed"
      },
      radii: {
        card: 18,
        chip: 12
      },
      shadows: {
        card: "0 12px 40px rgba(20,30,80,0.55)"
      },
      scoreBarShape: "glass"
    },
    layoutVariant: {
      scorePosition: "top",
      playerCardStyle: "cutout",
      boundaryStyle: "glow-ring"
    },
    motion: {
      entrance: "blur",
      easing: "power2.out",
      durationMs: 600
    }
  };

  // ../shared/src/looks-data/pitch-green.json
  var pitch_green_default = {
    id: "pitch-green",
    name: "Pitch Green",
    plan: "pro",
    tokens: {
      colors: {
        bg: "#0B1F14",
        surface: "#123022",
        accent: "#5DDB6A",
        accent2: "#D6F36B",
        warn: "#FFC247",
        text: "#EAFBEF"
      },
      gradients: {
        accent: "linear-gradient(90deg, #5DDB6A, #D6F36B)"
      },
      fonts: {
        heading: "Space Grotesk",
        body: "Inter",
        numbers: "Barlow Condensed"
      },
      radii: {
        card: 10,
        chip: 6
      },
      shadows: {
        card: "0 8px 20px rgba(0,0,0,0.4)"
      },
      scoreBarShape: "slanted"
    },
    layoutVariant: {
      scorePosition: "top",
      playerCardStyle: "badge",
      boundaryStyle: "split-bar"
    },
    motion: {
      entrance: "zoom",
      easing: "back.out(1.4)",
      durationMs: 480
    }
  };

  // ../shared/src/looks-data/sandstone.json
  var sandstone_default = {
    id: "sandstone",
    name: "Sandstone",
    plan: "pro",
    tokens: {
      colors: {
        bg: "#2B2118",
        surface: "#3A2E22",
        accent: "#E0B97A",
        accent2: "#C8553D",
        warn: "#F2C14E",
        text: "#FFF6E5"
      },
      gradients: {
        accent: "linear-gradient(90deg, #E0B97A, #C8553D)"
      },
      fonts: {
        heading: "Space Grotesk",
        body: "Inter",
        numbers: "Barlow Condensed"
      },
      radii: {
        card: 4,
        chip: 2
      },
      shadows: {
        card: "0 6px 0 rgba(0,0,0,0.25)"
      },
      scoreBarShape: "notched"
    },
    layoutVariant: {
      scorePosition: "bottom",
      playerCardStyle: "cutout",
      boundaryStyle: "banner-sweep"
    },
    motion: {
      entrance: "curtain",
      easing: "power3.inOut",
      durationMs: 650
    }
  };

  // ../shared/src/looks-data/k01.json
  var k01_default = {
    id: "k01",
    name: "Stadium Gold",
    plan: "pro",
    tokens: {
      colors: {
        bg: "#0A0E17",
        surface: "#0F172A",
        accent: "#F59E0B",
        accent2: "#D97706",
        warn: "#FBBF24",
        text: "#F8FAFC"
      },
      gradients: {
        accent: "linear-gradient(90deg, #F59E0B, #D97706)"
      },
      fonts: {
        heading: "Space Grotesk",
        body: "Inter",
        numbers: "Barlow Condensed"
      },
      radii: {
        card: 16,
        chip: 8
      },
      shadows: {
        card: "0 10px 30px rgba(245,158,11,0.25)"
      },
      scoreBarShape: "pill"
    },
    layoutVariant: {
      scorePosition: "top",
      playerCardStyle: "cutout",
      boundaryStyle: "split-bar"
    },
    motion: {
      entrance: "slide",
      easing: "power2.out",
      durationMs: 480
    }
  };

  // ../shared/src/looks-data/k02.json
  var k02_default = {
    id: "k02",
    name: "Stadium Emerald",
    plan: "pro",
    tokens: {
      colors: {
        bg: "#022C22",
        surface: "#064E3B",
        accent: "#10B981",
        accent2: "#34D399",
        warn: "#FBBF24",
        text: "#F0FDF4"
      },
      gradients: {
        accent: "linear-gradient(90deg, #10B981, #34D399)"
      },
      fonts: {
        heading: "Space Grotesk",
        body: "Inter",
        numbers: "Barlow Condensed"
      },
      radii: {
        card: 14,
        chip: 8
      },
      shadows: {
        card: "0 10px 30px rgba(16,185,129,0.25)"
      },
      scoreBarShape: "floating"
    },
    layoutVariant: {
      scorePosition: "bottom",
      playerCardStyle: "badge-right",
      boundaryStyle: "edge-flash"
    },
    motion: {
      entrance: "rise",
      easing: "power2.out",
      durationMs: 480
    }
  };

  // ../shared/src/looks-data/k03.json
  var k03_default = {
    id: "k03",
    name: "Neon Cyan",
    plan: "pro",
    tokens: {
      colors: {
        bg: "#031726",
        surface: "#082F49",
        accent: "#06B6D4",
        accent2: "#38BDF8",
        warn: "#FBBF24",
        text: "#F0F9FF"
      },
      gradients: {
        accent: "linear-gradient(90deg, #06B6D4, #38BDF8)"
      },
      fonts: {
        heading: "Space Grotesk",
        body: "Inter",
        numbers: "Barlow Condensed"
      },
      radii: {
        card: 12,
        chip: 6
      },
      shadows: {
        card: "0 0 24px rgba(6,182,212,0.4)"
      },
      scoreBarShape: "pill"
    },
    layoutVariant: {
      scorePosition: "bottom",
      playerCardStyle: "round-badge",
      boundaryStyle: "split-bar"
    },
    motion: {
      entrance: "glitch",
      easing: "power2.out",
      durationMs: 450
    }
  };

  // ../shared/src/looks-data/k04.json
  var k04_default = {
    id: "k04",
    name: "Neon Magenta",
    plan: "pro",
    tokens: {
      colors: {
        bg: "#1E082B",
        surface: "#3B0764",
        accent: "#EC4899",
        accent2: "#D946EF",
        warn: "#FBBF24",
        text: "#FDF2F8"
      },
      gradients: {
        accent: "linear-gradient(90deg, #EC4899, #D946EF)"
      },
      fonts: {
        heading: "Space Grotesk",
        body: "Inter",
        numbers: "Barlow Condensed"
      },
      radii: {
        card: 8,
        chip: 4
      },
      shadows: {
        card: "0 0 24px rgba(236,72,153,0.45)"
      },
      scoreBarShape: "arrow"
    },
    layoutVariant: {
      scorePosition: "top",
      playerCardStyle: "mirrored",
      boundaryStyle: "glow-ring"
    },
    motion: {
      entrance: "iris",
      easing: "power2.inOut",
      durationMs: 520
    }
  };

  // ../shared/src/looks-data/k05.json
  var k05_default = {
    id: "k05",
    name: "Neon Lime",
    plan: "pro",
    tokens: {
      colors: {
        bg: "#0D1E08",
        surface: "#1A380E",
        accent: "#84CC16",
        accent2: "#A3E635",
        warn: "#FBBF24",
        text: "#F7FEE7"
      },
      gradients: {
        accent: "linear-gradient(90deg, #84CC16, #A3E635)"
      },
      fonts: {
        heading: "Space Grotesk",
        body: "Inter",
        numbers: "Barlow Condensed"
      },
      radii: {
        card: 12,
        chip: 6
      },
      shadows: {
        card: "0 0 20px rgba(132,204,22,0.35)"
      },
      scoreBarShape: "floating"
    },
    layoutVariant: {
      scorePosition: "top",
      playerCardStyle: "badge-right",
      boundaryStyle: "edge-flash"
    },
    motion: {
      entrance: "blinds",
      easing: "power2.out",
      durationMs: 460
    }
  };

  // ../shared/src/looks-data/k08.json
  var k08_default = {
    id: "k08",
    name: "Broadcast Teal",
    plan: "pro",
    tokens: {
      colors: {
        bg: "#041F1E",
        surface: "#0F3A38",
        accent: "#14B8A6",
        accent2: "#2DD4BF",
        warn: "#FBBF24",
        text: "#F0FDFA"
      },
      gradients: {
        accent: "linear-gradient(90deg, #14B8A6, #2DD4BF)"
      },
      fonts: {
        heading: "Space Grotesk",
        body: "Inter",
        numbers: "Barlow Condensed"
      },
      radii: {
        card: 12,
        chip: 6
      },
      shadows: {
        card: "0 8px 26px rgba(20,184,166,0.3)"
      },
      scoreBarShape: "floating"
    },
    layoutVariant: {
      scorePosition: "bottom",
      playerCardStyle: "cutout",
      boundaryStyle: "banner-sweep"
    },
    motion: {
      entrance: "curtain",
      easing: "power3.inOut",
      durationMs: 550
    }
  };

  // ../shared/src/looks-data/k09.json
  var k09_default = {
    id: "k09",
    name: "Retro Amber LED",
    plan: "pro",
    tokens: {
      colors: {
        bg: "#181105",
        surface: "#2D1F0A",
        accent: "#F59E0B",
        accent2: "#FBBF24",
        warn: "#D97706",
        text: "#FEF3C7"
      },
      gradients: {
        accent: "linear-gradient(90deg, #F59E0B, #FBBF24)"
      },
      fonts: {
        heading: "Space Grotesk",
        body: "Inter",
        numbers: "Barlow Condensed"
      },
      radii: {
        card: 4,
        chip: 2
      },
      shadows: {
        card: "0 6px 18px rgba(245,158,11,0.25)"
      },
      scoreBarShape: "flat"
    },
    layoutVariant: {
      scorePosition: "bottom",
      playerCardStyle: "mirrored",
      boundaryStyle: "spark"
    },
    motion: {
      entrance: "flip",
      easing: "power2.out",
      durationMs: 500
    }
  };

  // ../shared/src/looks-data/k10.json
  var k10_default = {
    id: "k10",
    name: "Retro Green LED",
    plan: "pro",
    tokens: {
      colors: {
        bg: "#051A0B",
        surface: "#0D3216",
        accent: "#22C55E",
        accent2: "#4ADE80",
        warn: "#EAB308",
        text: "#F0FDF4"
      },
      gradients: {
        accent: "linear-gradient(90deg, #22C55E, #4ADE80)"
      },
      fonts: {
        heading: "Space Grotesk",
        body: "Inter",
        numbers: "Barlow Condensed"
      },
      radii: {
        card: 6,
        chip: 2
      },
      shadows: {
        card: "0 8px 24px rgba(34,197,94,0.3)"
      },
      scoreBarShape: "slanted"
    },
    layoutVariant: {
      scorePosition: "top",
      playerCardStyle: "cutout",
      boundaryStyle: "split-bar"
    },
    motion: {
      entrance: "unfold",
      easing: "power3.out",
      durationMs: 520
    }
  };

  // ../shared/src/looks-data/k11.json
  var k11_default = {
    id: "k11",
    name: "Street Blaze",
    plan: "pro",
    tokens: {
      colors: {
        bg: "#1C0D06",
        surface: "#34180C",
        accent: "#F97316",
        accent2: "#EF4444",
        warn: "#FBBF24",
        text: "#FFF7ED"
      },
      gradients: {
        accent: "linear-gradient(90deg, #F97316, #EF4444)"
      },
      fonts: {
        heading: "Space Grotesk",
        body: "Inter",
        numbers: "Barlow Condensed"
      },
      radii: {
        card: 6,
        chip: 4
      },
      shadows: {
        card: "0 8px 28px rgba(249,115,22,0.35)"
      },
      scoreBarShape: "arrow"
    },
    layoutVariant: {
      scorePosition: "bottom",
      playerCardStyle: "mirrored",
      boundaryStyle: "spark"
    },
    motion: {
      entrance: "skew",
      easing: "expo.out",
      durationMs: 480
    }
  };

  // ../shared/src/looks-data/k12.json
  var k12_default = {
    id: "k12",
    name: "Street Pink",
    plan: "pro",
    tokens: {
      colors: {
        bg: "#1C060F",
        surface: "#360F20",
        accent: "#F43F5E",
        accent2: "#FB7185",
        warn: "#FBBF24",
        text: "#FFF1F2"
      },
      gradients: {
        accent: "linear-gradient(90deg, #F43F5E, #FB7185)"
      },
      fonts: {
        heading: "Space Grotesk",
        body: "Inter",
        numbers: "Barlow Condensed"
      },
      radii: {
        card: 8,
        chip: 4
      },
      shadows: {
        card: "0 8px 26px rgba(244,63,94,0.35)"
      },
      scoreBarShape: "arrow"
    },
    layoutVariant: {
      scorePosition: "bottom",
      playerCardStyle: "badge-right",
      boundaryStyle: "glow-ring"
    },
    motion: {
      entrance: "pop",
      easing: "back.out(1.5)",
      durationMs: 460
    }
  };

  // ../shared/src/looks-data/k13.json
  var k13_default = {
    id: "k13",
    name: "Street Yellow",
    plan: "pro",
    tokens: {
      colors: {
        bg: "#1C1604",
        surface: "#332909",
        accent: "#EAB308",
        accent2: "#FACC15",
        warn: "#F97316",
        text: "#FEFCE8"
      },
      gradients: {
        accent: "linear-gradient(90deg, #EAB308, #FACC15)"
      },
      fonts: {
        heading: "Space Grotesk",
        body: "Inter",
        numbers: "Barlow Condensed"
      },
      radii: {
        card: 6,
        chip: 4
      },
      shadows: {
        card: "0 8px 26px rgba(234,179,8,0.3)"
      },
      scoreBarShape: "arrow"
    },
    layoutVariant: {
      scorePosition: "top",
      playerCardStyle: "mirrored",
      boundaryStyle: "edge-flash"
    },
    motion: {
      entrance: "drop",
      easing: "power2.out",
      durationMs: 480
    }
  };

  // ../shared/src/looks-data/k14.json
  var k14_default = {
    id: "k14",
    name: "Royal Gold",
    plan: "pro",
    tokens: {
      colors: {
        bg: "#110E08",
        surface: "#251C0D",
        accent: "#D4AF37",
        accent2: "#FBBF24",
        warn: "#EAB308",
        text: "#FEF9C3"
      },
      gradients: {
        accent: "linear-gradient(90deg, #D4AF37, #FBBF24)"
      },
      fonts: {
        heading: "Space Grotesk",
        body: "Inter",
        numbers: "Barlow Condensed"
      },
      radii: {
        card: 20,
        chip: 10
      },
      shadows: {
        card: "0 10px 32px rgba(212,175,55,0.4)"
      },
      scoreBarShape: "pill"
    },
    layoutVariant: {
      scorePosition: "top",
      playerCardStyle: "round-badge",
      boundaryStyle: "sweeping"
    },
    motion: {
      entrance: "fade",
      easing: "power2.out",
      durationMs: 500
    }
  };

  // ../shared/src/looks-data/k15.json
  var k15_default = {
    id: "k15",
    name: "Royal Silver",
    plan: "pro",
    tokens: {
      colors: {
        bg: "#0F172A",
        surface: "#1E293B",
        accent: "#94A3B8",
        accent2: "#CBD5E1",
        warn: "#FBBF24",
        text: "#F8FAFC"
      },
      gradients: {
        accent: "linear-gradient(90deg, #94A3B8, #CBD5E1)"
      },
      fonts: {
        heading: "Space Grotesk",
        body: "Inter",
        numbers: "Barlow Condensed"
      },
      radii: {
        card: 4,
        chip: 2
      },
      shadows: {
        card: "0 8px 24px rgba(148,163,184,0.25)"
      },
      scoreBarShape: "notched"
    },
    layoutVariant: {
      scorePosition: "bottom",
      playerCardStyle: "round-badge",
      boundaryStyle: "corner-tag"
    },
    motion: {
      entrance: "swing",
      easing: "power2.out",
      durationMs: 520
    }
  };

  // ../shared/src/looks-data/k16.json
  var k16_default = {
    id: "k16",
    name: "Glass Sky",
    plan: "pro",
    tokens: {
      colors: {
        bg: "#081A28",
        surface: "#0F2D42",
        accent: "#38BDF8",
        accent2: "#7DD3FC",
        warn: "#FBBF24",
        text: "#F0F9FF"
      },
      gradients: {
        accent: "linear-gradient(90deg, #38BDF8, #7DD3FC)"
      },
      fonts: {
        heading: "Space Grotesk",
        body: "Inter",
        numbers: "Barlow Condensed"
      },
      radii: {
        card: 16,
        chip: 8
      },
      shadows: {
        card: "0 12px 36px rgba(56,189,248,0.35)"
      },
      scoreBarShape: "glass"
    },
    layoutVariant: {
      scorePosition: "top",
      playerCardStyle: "cutout",
      boundaryStyle: "glow-ring"
    },
    motion: {
      entrance: "blur",
      easing: "power2.out",
      durationMs: 550
    }
  };

  // ../shared/src/looks-data/k17.json
  var k17_default = {
    id: "k17",
    name: "Glass Rose",
    plan: "pro",
    tokens: {
      colors: {
        bg: "#1F0810",
        surface: "#38121F",
        accent: "#FB7185",
        accent2: "#FDA4AF",
        warn: "#FBBF24",
        text: "#FFF1F2"
      },
      gradients: {
        accent: "linear-gradient(90deg, #FB7185, #FDA4AF)"
      },
      fonts: {
        heading: "Space Grotesk",
        body: "Inter",
        numbers: "Barlow Condensed"
      },
      radii: {
        card: 16,
        chip: 8
      },
      shadows: {
        card: "0 12px 36px rgba(251,113,133,0.35)"
      },
      scoreBarShape: "glass"
    },
    layoutVariant: {
      scorePosition: "bottom",
      playerCardStyle: "round-badge",
      boundaryStyle: "corner-tag"
    },
    motion: {
      entrance: "zoom-out",
      easing: "power3.out",
      durationMs: 520
    }
  };

  // ../shared/src/looks-data/k18.json
  var k18_default = {
    id: "k18",
    name: "Glass Mint",
    plan: "pro",
    tokens: {
      colors: {
        bg: "#041F15",
        surface: "#0D3827",
        accent: "#34D399",
        accent2: "#6EE7B7",
        warn: "#FBBF24",
        text: "#F0FDF4"
      },
      gradients: {
        accent: "linear-gradient(90deg, #34D399, #6EE7B7)"
      },
      fonts: {
        heading: "Space Grotesk",
        body: "Inter",
        numbers: "Barlow Condensed"
      },
      radii: {
        card: 6,
        chip: 2
      },
      shadows: {
        card: "0 10px 30px rgba(52,211,153,0.3)"
      },
      scoreBarShape: "notched"
    },
    layoutVariant: {
      scorePosition: "top",
      playerCardStyle: "mirrored",
      boundaryStyle: "edge-flash"
    },
    motion: {
      entrance: "slide-right",
      easing: "power2.out",
      durationMs: 480
    }
  };

  // ../shared/src/looks-data/k19.json
  var k19_default = {
    id: "k19",
    name: "Carbon Red",
    plan: "pro",
    tokens: {
      colors: {
        bg: "#0C0C0E",
        surface: "#18181B",
        accent: "#EF4444",
        accent2: "#F87171",
        warn: "#FBBF24",
        text: "#F4F4F5"
      },
      gradients: {
        accent: "linear-gradient(90deg, #EF4444, #F87171)"
      },
      fonts: {
        heading: "Space Grotesk",
        body: "Inter",
        numbers: "Barlow Condensed"
      },
      radii: {
        card: 4,
        chip: 2
      },
      shadows: {
        card: "0 8px 24px rgba(239,68,68,0.3)"
      },
      scoreBarShape: "slanted"
    },
    layoutVariant: {
      scorePosition: "bottom",
      playerCardStyle: "cutout",
      boundaryStyle: "spark"
    },
    motion: {
      entrance: "stretch",
      easing: "power3.out",
      durationMs: 500
    }
  };

  // ../shared/src/looks-data/k20.json
  var k20_default = {
    id: "k20",
    name: "Carbon Orange",
    plan: "pro",
    tokens: {
      colors: {
        bg: "#0C0C0E",
        surface: "#18181B",
        accent: "#F97316",
        accent2: "#FB923C",
        warn: "#FBBF24",
        text: "#F4F4F5"
      },
      gradients: {
        accent: "linear-gradient(90deg, #F97316, #FB923C)"
      },
      fonts: {
        heading: "Space Grotesk",
        body: "Inter",
        numbers: "Barlow Condensed"
      },
      radii: {
        card: 4,
        chip: 2
      },
      shadows: {
        card: "0 8px 24px rgba(249,115,22,0.3)"
      },
      scoreBarShape: "slanted"
    },
    layoutVariant: {
      scorePosition: "top",
      playerCardStyle: "round-badge",
      boundaryStyle: "edge-flash"
    },
    motion: {
      entrance: "diamond",
      easing: "power2.inOut",
      durationMs: 500
    }
  };

  // ../shared/src/looks-data/k21.json
  var k21_default = {
    id: "k21",
    name: "Mono Gold",
    plan: "pro",
    tokens: {
      colors: {
        bg: "#050505",
        surface: "#121212",
        accent: "#EAB308",
        accent2: "#FEF08A",
        warn: "#F97316",
        text: "#FAFAFA"
      },
      gradients: {
        accent: "linear-gradient(90deg, #EAB308, #FEF08A)"
      },
      fonts: {
        heading: "Space Grotesk",
        body: "Inter",
        numbers: "Barlow Condensed"
      },
      radii: {
        card: 4,
        chip: 2
      },
      shadows: {
        card: "0 0 0 1px rgba(234,179,8,0.4)"
      },
      scoreBarShape: "slanted"
    },
    layoutVariant: {
      scorePosition: "bottom",
      playerCardStyle: "cutout",
      boundaryStyle: "gold-flare"
    },
    motion: {
      entrance: "zoom",
      easing: "back.out(1.4)",
      durationMs: 480
    }
  };

  // ../shared/src/looks-data/k22.json
  var k22_default = {
    id: "k22",
    name: "Mono Ice",
    plan: "pro",
    tokens: {
      colors: {
        bg: "#030712",
        surface: "#0B1120",
        accent: "#7DD3FC",
        accent2: "#E0F2FE",
        warn: "#FBBF24",
        text: "#F0F9FF"
      },
      gradients: {
        accent: "linear-gradient(90deg, #7DD3FC, #E0F2FE)"
      },
      fonts: {
        heading: "Space Grotesk",
        body: "Inter",
        numbers: "Barlow Condensed"
      },
      radii: {
        card: 4,
        chip: 2
      },
      shadows: {
        card: "0 0 0 1px rgba(125,211,252,0.35)"
      },
      scoreBarShape: "notched"
    },
    layoutVariant: {
      scorePosition: "bottom",
      playerCardStyle: "badge-right",
      boundaryStyle: "edge-flash"
    },
    motion: {
      entrance: "spin",
      easing: "power2.out",
      durationMs: 540
    }
  };

  // ../shared/src/looks-data/k23.json
  var k23_default = {
    id: "k23",
    name: "Festival Sunset",
    plan: "pro",
    tokens: {
      colors: {
        bg: "#18081F",
        surface: "#2E103D",
        accent: "#FB923C",
        accent2: "#EC4899",
        warn: "#FBBF24",
        text: "#FFF7ED"
      },
      gradients: {
        accent: "linear-gradient(90deg, #FB923C, #EC4899)"
      },
      fonts: {
        heading: "Space Grotesk",
        body: "Inter",
        numbers: "Barlow Condensed"
      },
      radii: {
        card: 8,
        chip: 4
      },
      shadows: {
        card: "0 10px 32px rgba(236,72,153,0.35)"
      },
      scoreBarShape: "notched"
    },
    layoutVariant: {
      scorePosition: "bottom",
      playerCardStyle: "badge-right",
      boundaryStyle: "burst"
    },
    motion: {
      entrance: "drop",
      easing: "power2.out",
      durationMs: 480
    }
  };

  // ../shared/src/looks-data/k24.json
  var k24_default = {
    id: "k24",
    name: "Festival Aurora",
    plan: "pro",
    tokens: {
      colors: {
        bg: "#080C21",
        surface: "#121B3D",
        accent: "#A855F7",
        accent2: "#2DD4BF",
        warn: "#FBBF24",
        text: "#F3E8FF"
      },
      gradients: {
        accent: "linear-gradient(90deg, #A855F7, #2DD4BF)"
      },
      fonts: {
        heading: "Space Grotesk",
        body: "Inter",
        numbers: "Barlow Condensed"
      },
      radii: {
        card: 12,
        chip: 6
      },
      shadows: {
        card: "0 10px 32px rgba(168,85,247,0.35)"
      },
      scoreBarShape: "flat"
    },
    layoutVariant: {
      scorePosition: "top",
      playerCardStyle: "badge-right",
      boundaryStyle: "glow-ring"
    },
    motion: {
      entrance: "zoom",
      easing: "back.out(1.4)",
      durationMs: 480
    }
  };

  // ../shared/src/looks-data/k25.json
  var k25_default = {
    id: "k25",
    name: "Mono Mint",
    plan: "pro",
    tokens: {
      colors: {
        bg: "#021411",
        surface: "#06241F",
        accent: "#2DD4BF",
        accent2: "#6EE7B7",
        warn: "#FBBF24",
        text: "#F0FDF4"
      },
      gradients: {
        accent: "linear-gradient(90deg, #2DD4BF, #6EE7B7)"
      },
      fonts: {
        heading: "Space Grotesk",
        body: "Inter",
        numbers: "Barlow Condensed"
      },
      radii: {
        card: 4,
        chip: 2
      },
      shadows: {
        card: "0 0 0 1px rgba(45,212,191,0.4)"
      },
      scoreBarShape: "notched"
    },
    layoutVariant: {
      scorePosition: "top",
      playerCardStyle: "round-badge",
      boundaryStyle: "edge-flash"
    },
    motion: {
      entrance: "pop",
      easing: "back.out(1.5)",
      durationMs: 460
    }
  };

  // ../shared/src/looks-data/sc-monsoon-night.json
  var sc_monsoon_night_default = {
    id: "sc-monsoon-night",
    name: "Monsoon Night",
    plan: "pro",
    tokens: {
      colors: {
        bg: "#0B1026",
        surface: "#141B3D",
        accent: "#4D7CFF",
        accent2: "#38D6F2",
        warn: "#FFC857",
        text: "#EAF0FF"
      },
      gradients: {
        accent: "linear-gradient(90deg, #4D7CFF, #38D6F2)"
      },
      fonts: {
        heading: "Space Grotesk",
        body: "Inter",
        numbers: "Barlow Condensed"
      },
      radii: {
        card: 18,
        chip: 10
      },
      shadows: {
        card: "0 12px 36px rgba(77,124,255,0.35)"
      },
      scoreBarShape: "glass"
    },
    layoutVariant: {
      scorePosition: "bottom",
      playerCardStyle: "mirrored",
      boundaryStyle: "glow-ring"
    },
    motion: {
      entrance: "blur",
      easing: "power3.out",
      durationMs: 560
    }
  };

  // ../shared/src/looks-data/sc-desert-dusk.json
  var sc_desert_dusk_default = {
    id: "sc-desert-dusk",
    name: "Desert Dusk",
    plan: "pro",
    tokens: {
      colors: {
        bg: "#2A140C",
        surface: "#4A2416",
        accent: "#FF8A3D",
        accent2: "#2FC4B2",
        warn: "#FFD166",
        text: "#FFF4E6"
      },
      gradients: {
        accent: "linear-gradient(90deg, #FF8A3D, #FFB36B)"
      },
      fonts: {
        heading: "Space Grotesk",
        body: "Inter",
        numbers: "Barlow Condensed"
      },
      radii: {
        card: 10,
        chip: 6
      },
      shadows: {
        card: "0 10px 28px rgba(255,138,61,0.30)"
      },
      scoreBarShape: "slanted"
    },
    layoutVariant: {
      scorePosition: "top",
      playerCardStyle: "badge",
      boundaryStyle: "banner-sweep"
    },
    motion: {
      entrance: "skew",
      easing: "power2.out",
      durationMs: 500
    }
  };

  // ../shared/src/looks-data/sc-paper-scoreboard.json
  var sc_paper_scoreboard_default = {
    id: "sc-paper-scoreboard",
    name: "Paper Scoreboard",
    plan: "pro",
    tokens: {
      colors: {
        bg: "#F5F1E8",
        surface: "#FFFFFF",
        accent: "#D6432B",
        accent2: "#1F2A44",
        warn: "#B7791F",
        text: "#1B1B1B"
      },
      gradients: {
        accent: "linear-gradient(90deg, #D6432B, #F06B4F)"
      },
      fonts: {
        heading: "Space Grotesk",
        body: "Inter",
        numbers: "Barlow Condensed"
      },
      radii: {
        card: 6,
        chip: 4
      },
      shadows: {
        card: "0 6px 18px rgba(31,42,68,0.18)"
      },
      scoreBarShape: "flat"
    },
    layoutVariant: {
      scorePosition: "bottom",
      playerCardStyle: "badge-right",
      boundaryStyle: "corner-tag"
    },
    motion: {
      entrance: "rise",
      easing: "power2.out",
      durationMs: 420
    }
  };

  // ../shared/src/looks-data/sc-royal-maroon.json
  var sc_royal_maroon_default = {
    id: "sc-royal-maroon",
    name: "Royal Maroon",
    plan: "pro",
    tokens: {
      colors: {
        bg: "#2B0A14",
        surface: "#451225",
        accent: "#E8D8B0",
        accent2: "#C9A24B",
        warn: "#F2C14E",
        text: "#FFF8EA"
      },
      gradients: {
        accent: "linear-gradient(90deg, #C9A24B, #E8D8B0)"
      },
      fonts: {
        heading: "Space Grotesk",
        body: "Inter",
        numbers: "Barlow Condensed"
      },
      radii: {
        card: 14,
        chip: 8
      },
      shadows: {
        card: "0 12px 32px rgba(201,162,75,0.28)"
      },
      scoreBarShape: "notched"
    },
    layoutVariant: {
      scorePosition: "top",
      playerCardStyle: "cutout",
      boundaryStyle: "gold-flare"
    },
    motion: {
      entrance: "curtain",
      easing: "power3.out",
      durationMs: 600
    }
  };

  // ../shared/src/looks-data/sc-arctic-mint.json
  var sc_arctic_mint_default = {
    id: "sc-arctic-mint",
    name: "Arctic Mint",
    plan: "pro",
    tokens: {
      colors: {
        bg: "#0E2230",
        surface: "#173547",
        accent: "#5EEAD4",
        accent2: "#A5F3FC",
        warn: "#FDE68A",
        text: "#F0FFFD"
      },
      gradients: {
        accent: "linear-gradient(90deg, #5EEAD4, #A5F3FC)"
      },
      fonts: {
        heading: "Space Grotesk",
        body: "Inter",
        numbers: "Barlow Condensed"
      },
      radii: {
        card: 20,
        chip: 12
      },
      shadows: {
        card: "0 10px 30px rgba(94,234,212,0.28)"
      },
      scoreBarShape: "line"
    },
    layoutVariant: {
      scorePosition: "top",
      playerCardStyle: "round-badge",
      boundaryStyle: "spark"
    },
    motion: {
      entrance: "fade",
      easing: "sine.out",
      durationMs: 520
    }
  };

  // ../shared/src/looks-data/sc-volt-carbon.json
  var sc_volt_carbon_default = {
    id: "sc-volt-carbon",
    name: "Volt Carbon",
    plan: "pro",
    tokens: {
      colors: {
        bg: "#0C0D10",
        surface: "#1A1C22",
        accent: "#D4FF2A",
        accent2: "#FF2E93",
        warn: "#FFB020",
        text: "#F5F7FA"
      },
      gradients: {
        accent: "linear-gradient(90deg, #D4FF2A, #8CFF2A)"
      },
      fonts: {
        heading: "Space Grotesk",
        body: "Inter",
        numbers: "Barlow Condensed"
      },
      radii: {
        card: 4,
        chip: 2
      },
      shadows: {
        card: "0 0 24px rgba(212,255,42,0.30)"
      },
      scoreBarShape: "arrow"
    },
    layoutVariant: {
      scorePosition: "bottom",
      playerCardStyle: "badge",
      boundaryStyle: "split-bar"
    },
    motion: {
      entrance: "glitch",
      easing: "power4.out",
      durationMs: 380
    }
  };

  // ../shared/src/looks.ts
  var graphiteTeal = LookSchema.parse(graphite_teal_default);
  var coralDusk = LookSchema.parse(coral_dusk_default);
  var ALL_LOOKS = [
    graphiteTeal,
    coralDusk,
    ...[midnight_glass_default, sandstone_default, pitch_green_default, ink_gold_default, aqua_mono_default, ember_default].map(
      (j) => LookSchema.parse(j)
    )
  ];
  var FREE_LOOKS = ALL_LOOKS.filter((l) => l.plan === "free");
  var PRO_LOOKS = ALL_LOOKS.filter((l) => l.plan === "pro");
  var DEFAULT_LOOK = LookSchema.parse(ink_gold_default);
  var PRO_LOOKS_23 = [
    k01_default,
    k02_default,
    k03_default,
    k04_default,
    k05_default,
    k08_default,
    k09_default,
    k10_default,
    k11_default,
    k12_default,
    k13_default,
    k14_default,
    k15_default,
    k16_default,
    k17_default,
    k18_default,
    k19_default,
    k20_default,
    k21_default,
    k22_default,
    k23_default,
    k24_default,
    k25_default,
    sc_monsoon_night_default,
    sc_desert_dusk_default,
    sc_paper_scoreboard_default,
    sc_royal_maroon_default,
    sc_arctic_mint_default,
    sc_volt_carbon_default
  ].map((j) => LookSchema.parse(j));
  var ALL_AVAILABLE_LOOKS = [...ALL_LOOKS, ...PRO_LOOKS_23];

  // ../shared/src/layouts.ts
  var OBS_LAYOUT_IDS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
  var LayoutPresetIdSchema = external_exports.enum(OBS_LAYOUT_IDS);

  // ../shared/src/settings.ts
  var CardIdSchema = external_exports.string().min(1);
  var DirectorTriggerSchema = external_exports.union([
    EngineEventTypeSchema,
    external_exports.literal("BATTER_40"),
    external_exports.literal("BATTER_90")
  ]);
  var DirectorRuleSchema = external_exports.object({
    on: DirectorTriggerSchema,
    card: CardIdSchema,
    durationSec: external_exports.number().min(1).max(60).default(8),
    cooldownSec: external_exports.number().min(0).max(600).default(30),
    priority: external_exports.number().int().default(0)
  });
  var CardSlugSchema = external_exports.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/);
  var DEFAULT_DIRECTOR_RULES = [
    { on: "OVER_END", card: "manhattan", durationSec: 8, cooldownSec: 30, priority: 1 },
    { on: "WICKET", card: "bowler-spell", durationSec: 8, cooldownSec: 20, priority: 3 },
    { on: "BATTER_40", card: "striker-profile", durationSec: 8, cooldownSec: 60, priority: 2 },
    { on: "BATTER_90", card: "striker-profile", durationSec: 8, cooldownSec: 60, priority: 2 },
    { on: "NEW_BATTER", card: "striker-profile", durationSec: 6, cooldownSec: 20, priority: 2 },
    { on: "MILESTONE", card: "milestone", durationSec: 8, cooldownSec: 20, priority: 4 },
    { on: "INNINGS_END", card: "full-scorecard", durationSec: 12, cooldownSec: 60, priority: 5 }
  ];
  var DEFAULT_CAROUSEL_CARDS = [
    "manhattan",
    "striker-profile",
    "bowler-spell",
    "partnership"
  ];
  var SettingsSchema = external_exports.object({
    syncDelaySec: external_exports.number().min(0).max(60).default(0),
    /** Seconds without fresh data before the watchdog warns (error at twice this). */
    watchdogSec: external_exports.number().min(5).max(600).default(30),
    /** Show a small "Data delayed" badge on the overlay while the watchdog is raised. */
    dataDelayedBadge: external_exports.boolean().default(false),
    /** Match shown on the overlay (DP-6). Null means the first/most recent one. */
    onStreamMatchId: external_exports.string().nullable().default(null),
    /** True once the first-run wizard has been finished (it can be reopened from Help). */
    setupComplete: external_exports.boolean().default(false),
    /** Server timestamp when the operator accepted responsibility for source-site terms. */
    sourceTermsAcceptedAt: external_exports.number().int().positive().nullable().default(null),
    cardScale: external_exports.number().min(0.8).max(2).default(1),
    sideCardScale: external_exports.number().min(0.8).max(2).default(1),
    cardWidth: external_exports.enum(["narrow", "normal", "wide"]).default("normal"),
    layout: external_exports.enum(["arena", "fullscreen", "ticker", "classic"]).default("arena"),
    onAirScreen: external_exports.enum(["auto", "pre", "live", "innings_break", "break", "result"]).default("auto"),
    theme: external_exports.string().default("ink-gold"),
    video: external_exports.object({
      sourceMode: external_exports.enum(["off", "obs", "capture", "stream", "embed"]).default("off"),
      sourceUrl: external_exports.string().max(2048).default(""),
      activeObsLayout: LayoutPresetIdSchema.default("A"),
      sceneRotation: external_exports.boolean().default(false),
      rotationSec: external_exports.number().int().min(5).max(600).default(90),
      rotationLayouts: external_exports.array(LayoutPresetIdSchema).default([...OBS_LAYOUT_IDS]),
      cameraMode: external_exports.enum(["none", "one", "two"]).default("none"),
      camerasOnBreaks: external_exports.boolean().default(true),
      alignmentGuides: external_exports.boolean().default(false),
      obsHost: external_exports.string().max(255).default("127.0.0.1"),
      obsPort: external_exports.number().int().min(1).max(65535).default(4455),
      obsScene: external_exports.string().max(255).default(""),
      tvTheme: external_exports.string().default("star-sports"),
      backgroundImage: external_exports.string().max(2048).nullable().default(null),
      backgroundDim: external_exports.number().min(0).max(0.8).default(0.3),
      obsMap: external_exports.object({ matchVideo: external_exports.string().max(255).default(""), cam1: external_exports.string().max(255).default(""), cam2: external_exports.string().max(255).default("") }).default({})
    }).default({}),
    director: external_exports.object({
      mode: external_exports.enum(["smart", "carousel", "manual"]).default("manual"),
      rules: external_exports.array(DirectorRuleSchema).default(DEFAULT_DIRECTOR_RULES),
      carousel: external_exports.object({
        cards: external_exports.array(CardSlugSchema).min(1).max(20).default(DEFAULT_CAROUSEL_CARDS),
        intervalSec: external_exports.number().min(5).max(120).default(15)
      }).default({})
    }).default({}),
    preMatch: external_exports.object({
      scene: external_exports.enum(["auto", "clock", "toss", "squad1", "squad2"]).default("auto"),
      clockSec: external_exports.number().int().min(5).max(600).default(90),
      tossSec: external_exports.number().int().min(5).max(600).default(45),
      squad1Sec: external_exports.number().int().min(5).max(600).default(120),
      squad2Sec: external_exports.number().int().min(5).max(600).default(90),
      matchLengthOvers: external_exports.number().int().min(1).max(100).nullable().default(null),
      venue: external_exports.string().max(255).default("")
    }).default({}),
    sounds: external_exports.object({
      masterVolume: external_exports.number().min(0).max(1).default(0.8),
      autoCelebrations: external_exports.boolean().default(true),
      auto: external_exports.object({
        four: external_exports.string().nullable().default(null),
        six: external_exports.string().nullable().default(null),
        wicket: external_exports.string().nullable().default(null),
        milestone: external_exports.string().nullable().default(null)
      }).default({})
    }).default({})
  });

  // ../shared/src/ws.ts
  var CHANNELS = [
    "state",
    "events",
    "cards",
    "sound",
    "layout",
    "health",
    "licence",
    "commentary"
  ];
  var ChannelSchema = external_exports.enum(CHANNELS);
  var ClientMessageSchema = external_exports.discriminatedUnion("type", [
    external_exports.object({ type: external_exports.literal("subscribe"), channels: external_exports.array(ChannelSchema).min(1) }),
    external_exports.object({ type: external_exports.literal("unsubscribe"), channels: external_exports.array(ChannelSchema).min(1) }),
    external_exports.object({ type: external_exports.literal("ping") })
  ]);
  var ServerMessageSchema = external_exports.union([
    external_exports.object({ type: external_exports.literal("ack"), channels: external_exports.array(ChannelSchema) }),
    external_exports.object({ type: external_exports.literal("pong") }),
    external_exports.object({ type: external_exports.literal("error"), message: external_exports.string() }),
    external_exports.object({
      type: external_exports.literal("message"),
      channel: ChannelSchema,
      event: external_exports.string().min(1),
      payload: external_exports.unknown(),
      ts: external_exports.number()
    })
  ]);

  // ../shared/src/cards.ts
  var CardCommandSchema = external_exports.discriminatedUnion("action", [
    external_exports.object({
      action: external_exports.literal("show"),
      cardId: external_exports.string().min(1),
      /** 0 means sticky until hidden. */
      durationSec: external_exports.number().min(0).max(600).default(8),
      source: external_exports.enum(["director", "operator"]).default("operator"),
      data: external_exports.record(external_exports.string(), external_exports.unknown()).optional()
    }),
    external_exports.object({ action: external_exports.literal("hide"), cardId: external_exports.string().optional() }),
    external_exports.object({ action: external_exports.literal("asset-updated"), id: external_exports.string().min(1) })
  ]);

  // ../shared/src/provider.ts
  var SourceSiteSchema = external_exports.enum(["cricbuzz", "crex"]);
  var RawSourceSchema = external_exports.enum(["cricbuzz", "crex", "manual", "api"]);
  var oversField = external_exports.object({
    overs: external_exports.number().int().min(0),
    balls: external_exports.number().int().min(0).max(5)
  });
  var RawUpdateSchema = external_exports.object({
    source: RawSourceSchema,
    matchId: external_exports.string().min(1),
    url: external_exports.string().url(),
    /** Epoch ms when the page data was captured. */
    capturedAt: external_exports.number().int().nonnegative(),
    /** 0-1: fraction of required fields parsed and passing sanity checks. */
    confidence: external_exports.number().min(0).max(1),
    fields: external_exports.object({
      title: external_exports.string().optional(),
      status: external_exports.string().optional(),
      venue: external_exports.string().optional(),
      toss: external_exports.string().optional(),
      teams: external_exports.array(external_exports.object({ name: external_exports.string(), short: external_exports.string().optional() })).max(2).default([]),
      innings: external_exports.array(
        external_exports.object({
          team: external_exports.string(),
          runs: external_exports.number().int().min(0),
          wkts: external_exports.number().int().min(0).max(10)
        }).merge(oversField)
      ).default([]),
      batters: external_exports.array(
        external_exports.object({
          name: external_exports.string(),
          runs: external_exports.number().int().min(0),
          balls: external_exports.number().int().min(0),
          fours: external_exports.number().int().min(0).optional(),
          sixes: external_exports.number().int().min(0).optional(),
          onStrike: external_exports.boolean().optional()
        })
      ).default([]),
      bowler: external_exports.object({
        name: external_exports.string(),
        overs: external_exports.number().int().min(0),
        balls: external_exports.number().int().min(0).max(5).default(0),
        maidens: external_exports.number().int().min(0),
        runs: external_exports.number().int().min(0),
        wkts: external_exports.number().int().min(0).max(10)
      }).optional(),
      thisOver: external_exports.array(external_exports.string()).default([]),
      lastBalls: external_exports.array(external_exports.string()).default([]),
      /** The page says the match has not started: the 0-0 innings below is a placeholder, not a score. */
      preMatch: external_exports.boolean().optional(),
      partnership: external_exports.object({ runs: external_exports.number().int().min(0), balls: external_exports.number().int().min(0) }).optional(),
      target: external_exports.number().int().positive().optional(),
      crr: external_exports.number().min(0).optional(),
      rrr: external_exports.number().min(0).optional(),
      day: external_exports.number().int().min(1).max(5).optional(),
      session: external_exports.string().optional(),
      resultText: external_exports.string().optional(),
      commentaryLast: external_exports.string().optional(),
      /** Sources that know the format (the manual scorer) say so instead of guessing from text. */
      format: external_exports.enum(["T20", "ODI", "TEST", "OTHER"]).optional(),
      oversLimit: external_exports.number().int().positive().optional()
    }),
    /** Names of expected fields the adapter could not find. */
    missing: external_exports.array(external_exports.string()).default([])
  });
  var ProviderHealthSchema = external_exports.enum(["connected", "stale", "down"]);
  var MatchSummarySchema = external_exports.object({
    matchId: external_exports.string().min(1),
    title: external_exports.string(),
    teams: external_exports.array(external_exports.string()).max(2),
    status: external_exports.string().optional(),
    source: external_exports.string()
  });

  // ../shared/src/ext.ts
  var PairRequestSchema = external_exports.object({ code: external_exports.string().regex(/^\d{6}$/) });
  var PairResponseSchema = external_exports.object({ token: external_exports.string().min(20) });
  var TabInfoSchema = external_exports.object({
    matchId: external_exports.string().min(1),
    url: external_exports.string().url(),
    /** Epoch ms of the last successful parse in that tab (even if unchanged). */
    lastUpdateAt: external_exports.number().int().nonnegative(),
    confidence: external_exports.number().min(0).max(1)
  });
  var HeartbeatSchema = external_exports.object({
    type: external_exports.literal("heartbeat"),
    extensionVersion: external_exports.string(),
    selectorsVersion: external_exports.number().int().nonnegative(),
    tabs: external_exports.array(TabInfoSchema).max(20)
  });
  var ExtClientMessageSchema = external_exports.discriminatedUnion("type", [
    external_exports.object({ type: external_exports.literal("auth"), token: external_exports.string().min(1) }),
    external_exports.object({ type: external_exports.literal("ping") }),
    external_exports.object({ type: external_exports.literal("update"), update: RawUpdateSchema }),
    external_exports.object({
      type: external_exports.literal("degraded"),
      site: external_exports.string(),
      url: external_exports.string(),
      confidence: external_exports.number(),
      missing: external_exports.array(external_exports.string()),
      at: external_exports.number()
    }),
    HeartbeatSchema
  ]);
  var ExtCommandSchema = external_exports.discriminatedUnion("command", [
    external_exports.object({ command: external_exports.literal("openMatch"), url: external_exports.string().url() }),
    external_exports.object({ command: external_exports.literal("focusMatch"), matchId: external_exports.string().min(1) }),
    external_exports.object({ command: external_exports.literal("closeMatch"), matchId: external_exports.string().min(1) }),
    external_exports.object({ command: external_exports.literal("reloadSelectors") }),
    external_exports.object({ command: external_exports.literal("killSwitch"), enabled: external_exports.boolean().default(true) })
  ]);
  var ExtServerMessageSchema = external_exports.union([
    external_exports.object({ type: external_exports.literal("authed") }),
    external_exports.object({ type: external_exports.literal("pong") }),
    external_exports.object({ type: external_exports.literal("command") }).and(ExtCommandSchema)
  ]);
  var EXT_PORT_RANGE = { from: 4e3, to: 4010 };

  // ../shared/src/factories.ts
  var createBall = (input = {}) => BallEventSchema.parse({
    over: 0,
    ball: 1,
    runs: 0,
    batterId: "batter",
    bowlerId: "bowler",
    ...input
  });
  var createMatchState = (overrides = {}) => {
    const score = overrides.score ?? { runs: 0, wkts: 0, overs: 0, balls: 0 };
    return MatchStateSchema.parse({
      id: "match-1",
      title: "Team A vs Team B",
      format: "T20",
      status: "pre",
      teams: [
        { id: "team-a", name: "Team A", short: "TMA", color: "#19D3C5" },
        { id: "team-b", name: "Team B", short: "TMB", color: "#FF6B57" }
      ],
      innings: [],
      currentInnings: 0,
      battingTeamId: "team-a",
      score,
      batters: [
        {
          playerId: "a-1",
          name: "Opener One",
          runs: 0,
          balls: 0,
          fours: 0,
          sixes: 0,
          onStrike: true
        },
        {
          playerId: "a-2",
          name: "Opener Two",
          runs: 0,
          balls: 0,
          fours: 0,
          sixes: 0,
          onStrike: false
        }
      ],
      bowler: {
        playerId: "b-1",
        name: "Bowler One",
        overs: 0,
        balls: 0,
        maidens: 0,
        runs: 0,
        wkts: 0
      },
      lastBalls: [],
      thisOver: [],
      partnership: { runs: 0, balls: 0 },
      crr: runRate(score),
      updatedAt: "2026-01-01T00:00:00.000Z",
      ...overrides
    });
  };

  // ../shared/src/fixtures/index.ts
  var teamRsa = { id: "team-rsa", name: "South Africa", short: "RSA", color: "#007A4D" };
  var teamPak = { id: "team-pak", name: "Pakistan", short: "PAK", color: "#115740" };
  var teamEng = { id: "team-eng", name: "England", short: "ENG", color: "#1E3A8A" };
  var overBalls = (over, runs, batterId, bowlerId) => runs.map((r, i) => createBall({ over, ball: i + 1, runs: r, batterId, bowlerId }));
  var t20Score = { runs: 98, wkts: 2, overs: 11, balls: 3 };
  var t20Over = overBalls(11, [1, 4, 0], "aiden-markram", "shaheen-afridi");
  var t20MidInnings = createMatchState({
    id: "fx-t20-mid",
    title: "South Africa vs Pakistan, 2nd T20I",
    format: "T20",
    status: "live",
    venue: "Newlands, Cape Town",
    toss: { winnerTeamId: "team-rsa", decision: "bat" },
    teams: [teamRsa, teamPak],
    innings: [
      { number: 1, battingTeamId: "team-rsa", score: t20Score, declared: false, allOut: false }
    ],
    currentInnings: 1,
    battingTeamId: "team-rsa",
    score: t20Score,
    batters: [
      {
        playerId: "aiden-markram",
        name: "Aiden Markram",
        runs: 41,
        balls: 28,
        fours: 4,
        sixes: 2,
        onStrike: true
      },
      {
        playerId: "heinrich-klaasen",
        name: "Heinrich Klaasen",
        runs: 12,
        balls: 8,
        fours: 1,
        sixes: 1,
        onStrike: false
      }
    ],
    bowler: {
      playerId: "shaheen-afridi",
      name: "Shaheen Afridi",
      overs: 2,
      balls: 3,
      maidens: 0,
      runs: 21,
      wkts: 1
    },
    lastBalls: t20Over,
    thisOver: t20Over,
    partnership: { runs: 34, balls: 19 },
    crr: runRate(t20Score),
    projected: 166,
    winProb: { teamA: 0.56, teamB: 0.44 },
    updatedAt: "2026-03-14T15:42:10.000Z"
  });
  var teamAus = { id: "team-aus", name: "Australia", short: "AUS", color: "#00843D" };
  var testScore = { runs: 241, wkts: 6, overs: 74, balls: 5 };
  var testOver = overBalls(74, [0, 1, 0, 0, 4, 0], "aiden-markram", "jofra-archer");
  var testDay4 = createMatchState({
    id: "fx-test-d4",
    title: "South Africa vs England, 1st Test",
    format: "TEST",
    status: "live",
    venue: "SuperSport Park, Centurion",
    toss: { winnerTeamId: "team-rsa", decision: "bat" },
    teams: [teamRsa, teamEng],
    innings: [
      {
        number: 1,
        battingTeamId: "team-rsa",
        score: { runs: 312, wkts: 10, overs: 102, balls: 4 },
        declared: false,
        allOut: true
      },
      {
        number: 2,
        battingTeamId: "team-eng",
        score: { runs: 289, wkts: 10, overs: 96, balls: 2 },
        declared: false,
        allOut: true
      },
      { number: 3, battingTeamId: "team-rsa", score: testScore, declared: false, allOut: false }
    ],
    currentInnings: 3,
    battingTeamId: "team-rsa",
    score: testScore,
    batters: [
      {
        playerId: "aiden-markram",
        name: "Aiden Markram",
        runs: 88,
        balls: 142,
        fours: 9,
        sixes: 1,
        onStrike: true
      },
      {
        playerId: "temba-bavuma",
        name: "Temba Bavuma",
        runs: 34,
        balls: 68,
        fours: 3,
        sixes: 0,
        onStrike: false
      }
    ],
    bowler: {
      playerId: "jofra-archer",
      name: "Jofra Archer",
      overs: 18,
      balls: 5,
      maidens: 3,
      runs: 62,
      wkts: 2
    },
    lastBalls: testOver,
    thisOver: testOver,
    partnership: { runs: 58, balls: 110 },
    crr: runRate(testScore),
    day: 4,
    session: "afternoon",
    updatedAt: "2026-03-14T15:42:10.000Z"
  });
  var rsaScore = { runs: 52, wkts: 1, overs: 17, balls: 0 };
  var rsaOver = [
    createBall({ over: 17, ball: 1, runs: 0, batterId: "aiden-markram", bowlerId: "pat-cummins" }),
    createBall({ over: 17, ball: 2, runs: 1, batterId: "aiden-markram", bowlerId: "pat-cummins" }),
    createBall({ over: 17, ball: 3, runs: 0, extras: { type: "noball", runs: 1 }, batterId: "ryan-rickelton", bowlerId: "pat-cummins" }),
    createBall({ over: 17, ball: 4, runs: 0, batterId: "ryan-rickelton", bowlerId: "pat-cummins" }),
    createBall({ over: 17, ball: 5, runs: 0, batterId: "ryan-rickelton", bowlerId: "pat-cummins" }),
    createBall({ over: 17, ball: 6, runs: 0, batterId: "ryan-rickelton", bowlerId: "pat-cummins" })
  ];
  var testRsaVsAus = createMatchState({
    id: "fx-rsa-aus-d4",
    title: "Test Match \u2022 South Africa vs Australia, 1st Test, Australia tour of South Africa, 2026",
    format: "TEST",
    status: "live",
    venue: "Kingsmead, Durban",
    toss: { winnerTeamId: "team-aus", decision: "bat" },
    teams: [teamRsa, teamAus],
    innings: [
      {
        number: 1,
        battingTeamId: "team-aus",
        score: { runs: 390, wkts: 10, overs: 112, balls: 4 },
        declared: false,
        allOut: true
      },
      {
        number: 2,
        battingTeamId: "team-rsa",
        score: { runs: 284, wkts: 10, overs: 88, balls: 2 },
        declared: false,
        allOut: true
      },
      {
        number: 3,
        battingTeamId: "team-aus",
        score: { runs: 314, wkts: 6, overs: 82, balls: 0 },
        declared: true,
        allOut: false
      },
      { number: 4, battingTeamId: "team-rsa", score: rsaScore, declared: false, allOut: false }
    ],
    currentInnings: 4,
    battingTeamId: "team-rsa",
    score: rsaScore,
    target: 421,
    lead: -368,
    batters: [
      {
        playerId: "aiden-markram",
        name: "Aiden Markram",
        runs: 26,
        balls: 48,
        fours: 3,
        sixes: 0,
        onStrike: true
      },
      {
        playerId: "ryan-rickelton",
        name: "Ryan Rickelton",
        runs: 22,
        balls: 54,
        fours: 2,
        sixes: 0,
        onStrike: false
      }
    ],
    bowler: {
      playerId: "pat-cummins",
      name: "Pat Cummins",
      overs: 6,
      balls: 0,
      maidens: 2,
      runs: 18,
      wkts: 1
    },
    lastBalls: rsaOver,
    thisOver: rsaOver,
    partnership: { runs: 45, balls: 81 },
    wicketsLeft: 9,
    crr: 3.06,
    rrr: 4.12,
    winProb: { teamA: 0.34, teamB: 0.66 },
    day: 4,
    session: "evening",
    updatedAt: "2026-03-14T15:42:10.000Z"
  });
  var resultScore = { runs: 170, wkts: 4, overs: 18, balls: 2 };
  var t20Result = createMatchState({
    id: "fx-t20-result",
    title: "South Africa vs Pakistan, 2nd T20I",
    format: "T20",
    status: "result",
    venue: "Newlands, Cape Town",
    toss: { winnerTeamId: "team-rsa", decision: "bat" },
    teams: [teamRsa, teamPak],
    innings: [
      {
        number: 1,
        battingTeamId: "team-rsa",
        score: { runs: 169, wkts: 7, overs: 20, balls: 0 },
        declared: false,
        allOut: false
      },
      { number: 2, battingTeamId: "team-pak", score: resultScore, declared: false, allOut: false }
    ],
    currentInnings: 2,
    battingTeamId: "team-pak",
    score: resultScore,
    target: 170,
    batters: [
      {
        playerId: "babar-azam",
        name: "Babar Azam",
        runs: 72,
        balls: 49,
        fours: 7,
        sixes: 2,
        onStrike: true
      },
      {
        playerId: "shadab-khan",
        name: "Shadab Khan",
        runs: 18,
        balls: 9,
        fours: 1,
        sixes: 1,
        onStrike: false
      }
    ],
    bowler: {
      playerId: "kagiso-rabada",
      name: "Kagiso Rabada",
      overs: 4,
      balls: 0,
      maidens: 0,
      runs: 38,
      wkts: 2
    },
    lastBalls: [],
    thisOver: [],
    partnership: { runs: 29, balls: 14 },
    crr: runRate(resultScore),
    rrr: 0,
    result: "Pakistan won by 6 wickets",
    updatedAt: "2026-03-14T17:48:00.000Z"
  });

  // ../shared/src/manual.ts
  var ManualSetupSchema = external_exports.object({
    title: external_exports.string().min(1).max(120).optional(),
    format: external_exports.enum(["T20", "ODI", "TEST", "OTHER"]).default("T20"),
    /** Overs per innings; defaults to 20 (T20) / 50 (ODI), none for Tests. */
    overs: external_exports.number().int().min(1).max(100).optional(),
    venue: external_exports.string().max(120).optional(),
    teams: external_exports.tuple([
      external_exports.object({
        name: external_exports.string().min(1).max(60),
        short: external_exports.string().min(1).max(5).optional(),
        players: external_exports.array(external_exports.string().min(1).max(60)).min(2).max(15)
      }),
      external_exports.object({
        name: external_exports.string().min(1).max(60),
        short: external_exports.string().min(1).max(5).optional(),
        players: external_exports.array(external_exports.string().min(1).max(60)).min(2).max(15)
      })
    ]).refine(([a, b]) => a.name.toLowerCase() !== b.name.toLowerCase(), {
      message: "Team names must differ"
    })
  });
  var extras = external_exports.object({
    type: external_exports.enum(["wide", "noball", "bye", "legbye"]),
    /** Total extra runs for the delivery (a wide that was run for 2 is `runs: 3`). */
    runs: external_exports.number().int().min(1).max(10)
  });
  var ManualCommandSchema = external_exports.discriminatedUnion("type", [
    external_exports.object({
      type: external_exports.literal("ball"),
      /** Runs off the bat (0-6). Byes and leg byes are extras, not bat runs. */
      runs: external_exports.number().int().min(0).max(6).default(0),
      extras: extras.optional(),
      wicket: external_exports.object({
        kind: WicketSchema.shape.kind,
        /** Defaults to the striker. A run out may dismiss the non-striker. */
        playerOutId: external_exports.string().optional(),
        newBatterId: external_exports.string().optional()
      }).optional()
    }),
    external_exports.object({ type: external_exports.literal("new-over"), bowlerId: external_exports.string().min(1) }),
    external_exports.object({
      type: external_exports.literal("set-batter"),
      slot: external_exports.enum(["striker", "nonStriker"]),
      playerId: external_exports.string().min(1)
    }),
    external_exports.object({ type: external_exports.literal("set-bowler"), playerId: external_exports.string().min(1) }),
    external_exports.object({ type: external_exports.literal("end-innings"), declared: external_exports.boolean().default(false) }),
    external_exports.object({
      type: external_exports.literal("set-toss"),
      winnerTeamId: external_exports.string().min(1),
      decision: external_exports.enum(["bat", "bowl"])
    }),
    external_exports.object({ type: external_exports.literal("set-result"), text: external_exports.string().min(1).max(160) })
  ]);

  // ../shared/src/history.ts
  var OverStatSchema = external_exports.object({
    over: external_exports.number().int().min(1),
    runs: external_exports.number().int().min(0),
    wkts: external_exports.number().int().min(0),
    /** True when the over was reconstructed from a gap in the feed. */
    approximate: external_exports.boolean().default(false)
  });
  var FallOfWicketSchema = external_exports.object({
    wkts: external_exports.number().int().min(1),
    runs: external_exports.number().int().min(0),
    overs: external_exports.number().int().min(0),
    balls: external_exports.number().int().min(0).max(5),
    out: external_exports.string().optional()
  });
  var InningsHistorySchema = external_exports.object({
    number: external_exports.number().int().min(1),
    battingTeamId: external_exports.string(),
    overs: external_exports.array(OverStatSchema),
    fow: external_exports.array(FallOfWicketSchema),
    /** Runs at the end of each completed over (index 0 = after over 1). Drives the worm. */
    cumulative: external_exports.array(external_exports.number().int().min(0))
  });
  var MatchHistorySchema = external_exports.object({
    matchId: external_exports.string(),
    innings: external_exports.array(InningsHistorySchema)
  });

  // ../shared/src/sound.ts
  var MAX_SOUND_SLOTS = 10;
  var SoundSlotSchema = external_exports.object({
    id: external_exports.string().min(1),
    title: external_exports.string().min(1).max(60),
    /** Path under /assets, e.g. sounds/four-cheer.wav */
    file: external_exports.string().min(1),
    includeInLoop: external_exports.boolean(),
    volume: external_exports.number().min(0).max(1)
  });
  var SoundCommandSchema = external_exports.discriminatedUnion("action", [
    /** Fire one slot immediately. */
    external_exports.object({
      action: external_exports.literal("play"),
      id: external_exports.string().min(1),
      volume: external_exports.number().min(0).max(1).optional()
    }),
    /** Start looping the given slots (those flagged `includeInLoop`). */
    external_exports.object({ action: external_exports.literal("loop-start"), ids: external_exports.array(external_exports.string()).max(MAX_SOUND_SLOTS) }),
    external_exports.object({ action: external_exports.literal("loop-stop") }),
    external_exports.object({ action: external_exports.literal("stop-all") }),
    external_exports.object({ action: external_exports.literal("master"), volume: external_exports.number().min(0).max(1) }),
    /** The library changed: refetch the slot list and re-decode. */
    external_exports.object({ action: external_exports.literal("library-updated") })
  ]);

  // ../shared/src/selectors.ts
  var DEFAULT_SELECTORS_PUBLIC_KEY = "4574bdfef7bd3781d6ed3b172374e7af44c92a9c2655276da4931e3311799c5a";
  var SelectorBundleSchema = external_exports.object({
    version: external_exports.number().int().positive(),
    updatedAt: external_exports.number().int().nonnegative(),
    selectors: external_exports.record(external_exports.string(), external_exports.any())
  });
  var SignedSelectorBundleSchema = external_exports.object({
    payload: external_exports.string().min(1),
    signature: external_exports.string().regex(/^[0-9a-fA-F]+$/),
    version: external_exports.number().int().positive(),
    updatedAt: external_exports.number().int().nonnegative()
  });
  var SelectorStatusSchema = external_exports.object({
    version: external_exports.number().int().positive(),
    updatedAt: external_exports.number().int().nonnegative(),
    source: external_exports.enum(["bundled", "remote"]),
    hasUpdate: external_exports.boolean(),
    lastCheckedAt: external_exports.number().int().nonnegative().optional()
  });
  function hexToBytes(hex2) {
    const clean2 = hex2.trim();
    if (clean2.length % 2 !== 0) throw new Error("Invalid hex string");
    const bytes = new Uint8Array(clean2.length / 2);
    for (let i = 0; i < clean2.length; i += 2) {
      bytes[i / 2] = parseInt(clean2.substring(i, i + 2), 16);
    }
    return bytes;
  }
  async function verifySignedSelectorBundle(signed, publicKeyHex = DEFAULT_SELECTORS_PUBLIC_KEY) {
    const parsed = SignedSelectorBundleSchema.safeParse(signed);
    if (!parsed.success) {
      return { valid: false, error: "Malformed signed selector envelope" };
    }
    const { payload, signature, version, updatedAt } = parsed.data;
    let bundle;
    try {
      const raw = JSON.parse(payload);
      const bundleParsed = SelectorBundleSchema.safeParse(raw);
      if (!bundleParsed.success) {
        return { valid: false, error: "Malformed bundle JSON payload" };
      }
      bundle = bundleParsed.data;
    } catch {
      return { valid: false, error: "Invalid JSON payload" };
    }
    if (bundle.version !== version || bundle.updatedAt !== updatedAt) {
      return { valid: false, error: "Envelope metadata does not match payload" };
    }
    const rawPubBytes = hexToBytes(publicKeyHex);
    const sigBytes = hexToBytes(signature);
    const dataBytes = new TextEncoder().encode(payload);
    try {
      if (typeof globalThis !== "undefined" && globalThis.crypto?.subtle) {
        const subtle = globalThis.crypto.subtle;
        const pubKey = await subtle.importKey(
          "raw",
          rawPubBytes,
          { name: "Ed25519" },
          false,
          ["verify"]
        );
        const ok = await subtle.verify(
          { name: "Ed25519" },
          pubKey,
          sigBytes,
          dataBytes
        );
        if (ok) return { valid: true, bundle };
      }
    } catch {
    }
    return { valid: false, error: "Signature verification failed (tampered bundle)" };
  }

  // ../shared/src/commentary.ts
  var CommentaryLanguageSchema = external_exports.enum(["hi", "ur", "en"]);
  var CommentaryConfigSchema = external_exports.object({
    enabled: external_exports.boolean().default(true),
    autoEvents: external_exports.boolean().default(true),
    voice: external_exports.string().default("default"),
    /** Hindi (Devanagari) by default; `ur` is Urdu in Nastaliq script, `en` English. */
    language: CommentaryLanguageSchema.default("hi"),
    /** Use the configured Gemini model for narration, falling back to the local phrasebook. */
    ai: external_exports.boolean().default(true),
    rate: external_exports.number().min(0.5).max(2).default(1),
    pitch: external_exports.number().min(0.5).max(2).default(1),
    volume: external_exports.number().min(0).max(1).default(1)
  });
  var CommentaryItemSchema = external_exports.object({
    id: external_exports.string(),
    text: external_exports.string(),
    eventType: external_exports.string().optional(),
    timestamp: external_exports.number(),
    /** So the speaker picks the right voice for the script it is about to read. */
    lang: CommentaryLanguageSchema.optional()
  });

  // src/adapters/config.ts
  var innings = (n) => [`inn${n}.team`, `inn${n}.score`, `inn${n}.overs`];
  var FIELD_KEYS = [
    "title",
    "status",
    "venue",
    "toss",
    "resultText",
    "commentaryLast",
    "team1",
    "team2",
    "battingTeam",
    "score",
    "overs",
    ...innings(1),
    ...innings(2),
    ...innings(3),
    ...innings(4),
    "batter1.name",
    "batter1.runs",
    "batter1.balls",
    "batter1.fours",
    "batter1.sixes",
    "batter2.name",
    "batter2.runs",
    "batter2.balls",
    "batter2.fours",
    "batter2.sixes",
    "bowler.name",
    "bowler.overs",
    "bowler.maidens",
    "bowler.runs",
    "bowler.wkts",
    "thisOver",
    "lastBalls",
    "partnership",
    "target",
    "crr",
    "rrr",
    "day",
    "session",
    "format"
  ];
  var FieldKeySchema = external_exports.enum(FIELD_KEYS);
  var TRANSFORMS = ["trim", "lower", "upper", "number", "digits"];
  var regexString = external_exports.string().refine((s) => {
    try {
      new RegExp(s);
      return true;
    } catch {
      return false;
    }
  }, "invalid regular expression");
  var DomRuleSchema = external_exports.object({
    /** Tried in order; the first element with a non-empty value wins. */
    selectors: external_exports.array(external_exports.string().min(1)).min(1),
    /** Read this attribute instead of textContent. */
    attr: external_exports.string().optional(),
    /** Applied to the text; group 1 is used when present, otherwise the whole match. */
    regex: regexString.optional(),
    transform: external_exports.enum(TRANSFORMS).optional(),
    /**
     * Text that must appear on the element's preceding sibling (or its container's leading
     * children). Sites reuse one class for both the "This Over" and "Recent" ball strips, so the
     * label is the only thing that tells them apart.
     */
    label: external_exports.string().min(1).optional()
  });
  var JsonTapSchema = external_exports.object({
    /** Matched against the URL of responses the page itself fetched. */
    urlRegex: regexString,
    /**
     * field -> path such as `$.score.runs` or `data.innings[0].overs`.
     *
     * A value containing `${…}` is a template instead of a single path: sites split what the engine
     * parses as one value across several keys (`teamScore` + `teamWkts` -> "197/6"), so a template
     * composes them. It resolves only when every placeholder resolves to a non-empty value.
     */
    map: external_exports.record(FieldKeySchema, external_exports.string().min(1))
  });
  var SelectorConfigSchema = external_exports.object({
    version: external_exports.number().int().positive(),
    site: SourceSiteSchema,
    urlPatterns: external_exports.array(regexString),
    /** Regex on the page URL; group 1 becomes the matchId. Falls back to the URL path. */
    matchIdRegex: regexString.optional(),
    jsonTaps: external_exports.array(JsonTapSchema).default([]),
    dom: external_exports.record(FieldKeySchema, DomRuleSchema).default({}),
    /** Fields that must parse (and pass sanity checks) for full confidence. */
    minConfidenceFields: external_exports.array(FieldKeySchema).default([])
  });

  // src/adapters/cricbuzz.ts
  var cricbuzzConfig = SelectorConfigSchema.parse(selectors_cricbuzz_default);

  // src/background/connector.ts
  var HEARTBEAT_MS = 5e3;
  var PING_MS = 15e3;
  var BACKOFF_START_MS = 1e3;
  var BACKOFF_MAX_MS = 3e4;
  var ALLOWED_HOSTS = [/(^|\.)cricbuzz\.com$/i, /(^|\.)crex\.com$/i, /(^|\.)crex\.live$/i];
  var OPEN = 1;
  var DISCOVERY_COOLDOWN_MS = 15e3;
  var PEER_PROBE_MS = 6e4;
  var MAX_TRACKED_TABS = 20;
  var Connector = class {
    constructor(deps) {
      this.deps = deps;
    }
    deps;
    token = null;
    port = null;
    socket = null;
    authed = false;
    heartbeatTimer = null;
    pingTimer = null;
    reconnectTimer = null;
    backoff = BACKOFF_START_MS;
    killed = false;
    started = false;
    activeSelectorsVersion = null;
    tracked = /* @__PURE__ */ new Map();
    lastDiscoveryAt = null;
    discoveryInFlight = null;
    pairInFlight = null;
    lastPairFailureAt = null;
    peerPorts = [];
    peerProbeAt = null;
    // ---- lifecycle --------------------------------------------------------------------------
    /**
     * Safe to call on every service-worker wake-up. The MV3 worker is killed after ~30 s idle, so
     * the open-match list is kept in storage: without it "close match tab"/"focus" find no tab and
     * the heartbeat reports zero open matches while scores keep flowing.
     */
    async init() {
      if (!this.started) {
        this.started = true;
        this.token = await this.deps.storage.get("token") ?? null;
        this.port = await this.deps.storage.get("port") ?? null;
        this.killed = await this.deps.storage.get("killed") ?? false;
        const custom2 = await this.deps.storage.get("customSelectors");
        if (custom2?.version) this.activeSelectorsVersion = custom2.version;
        const saved = await this.deps.storage.get("trackedTabs");
        if (Array.isArray(saved)) {
          for (const t of saved) {
            if (t && typeof t.matchId === "string") this.tracked.set(t.matchId, t);
          }
        }
      }
      if (this.token && !this.socket) await this.connect();
      else if (!this.token && !this.killed) await this.autoPair();
    }
    persistTracked() {
      const keep = [...this.tracked.values()].sort((a, b) => b.lastUpdateAt - a.lastUpdateAt).slice(0, MAX_TRACKED_TABS);
      void Promise.resolve(this.deps.storage.set("trackedTabs", keep)).catch(() => void 0);
    }
    get paired() {
      return this.token !== null;
    }
    get boundPort() {
      return this.port;
    }
    /**
     * Pair without a code. Concurrent content scripts must share one attempt, and a failed
     * attempt is remembered so a server that is not running is not swept and re-paired every
     * few seconds per tab.
     */
    async autoPair() {
      if (this.token) return true;
      if (this.pairInFlight) return this.pairInFlight;
      const now = this.deps.now();
      if (this.lastPairFailureAt !== null && now - this.lastPairFailureAt < DISCOVERY_COOLDOWN_MS) {
        return false;
      }
      const run = this.tryAutoPair().then((ok) => {
        this.lastPairFailureAt = ok ? null : this.deps.now();
        return ok;
      });
      this.pairInFlight = run;
      try {
        return await run;
      } finally {
        if (this.pairInFlight === run) this.pairInFlight = null;
      }
    }
    async tryAutoPair() {
      const port = await this.discoverPort();
      if (port === null) return false;
      for (const host of ["127.0.0.1", "localhost"]) {
        try {
          const res = await this.deps.fetch(`http://${host}:${port}/api/ext/auto-pair`, {
            method: "POST"
          });
          if (res.ok) {
            const body = await res.json();
            if (body.token) {
              this.token = body.token;
              await this.deps.storage.set("token", body.token);
              await this.connect();
              return true;
            }
          }
        } catch {
        }
      }
      return false;
    }
    async pair(code) {
      const port = await this.discoverPort();
      if (port === null) return false;
      for (const host of ["127.0.0.1", "localhost"]) {
        try {
          const res = await this.deps.fetch(`http://${host}:${port}/api/ext/pair`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ code })
          });
          if (res.ok) {
            const body = await res.json();
            if (body.token) {
              this.token = body.token;
              await this.deps.storage.set("token", body.token);
              await this.connect();
              return true;
            }
          }
        } catch {
        }
      }
      return false;
    }
    async unpair() {
      this.token = null;
      await this.deps.storage.remove("token");
      this.teardown(true);
      if (!this.killed) {
        void this.autoPair();
      }
    }
    // ---- messages from content scripts ------------------------------------------------------
    track(info) {
      this.tracked.set(info.matchId, info);
      this.persistTracked();
    }
    async onContentMessage(msg, tabId) {
      if (this.killed) return;
      if (!this.token) {
        await this.autoPair();
      }
      const now = this.deps.now();
      if (msg.type === "score-update") {
        const u = msg.update;
        this.track({
          matchId: u.matchId,
          url: u.url,
          lastUpdateAt: now,
          confidence: u.confidence,
          tabId
        });
        await this.send({ type: "update", update: u });
      } else if (msg.type === "tick") {
        this.track({
          matchId: msg.matchId,
          url: msg.url,
          lastUpdateAt: now,
          confidence: msg.confidence,
          tabId
        });
      } else {
        let matchId = "live-tab";
        try {
          const p = new URL(msg.url).pathname.replace(/^\/+|\/+$/g, "").replace(/\//g, "-");
          if (p) matchId = p;
        } catch {
        }
        this.track({
          matchId,
          url: msg.url,
          lastUpdateAt: now,
          confidence: msg.confidence,
          tabId
        });
        await this.send({
          type: "degraded",
          site: msg.site,
          url: msg.url,
          confidence: msg.confidence,
          missing: msg.missing,
          at: msg.at
        });
      }
    }
    /** Tab closed by the user: stop reporting it so the server can mark it gone. */
    onTabRemoved(tabId) {
      let changed = false;
      for (const [id, t] of this.tracked)
        if (t.tabId === tabId) {
          this.tracked.delete(id);
          changed = true;
        }
      if (changed) this.persistTracked();
    }
    get tabs() {
      return [...this.tracked.values()].slice(0, MAX_TRACKED_TABS).map(({ tabId: _tabId, ...t }) => t);
    }
    // ---- transport --------------------------------------------------------------------------
    peerTokens = /* @__PURE__ */ new Map();
    async ensurePeerToken(p) {
      if (this.peerTokens.has(p)) return this.peerTokens.get(p);
      try {
        const res = await this.deps.fetch(`http://127.0.0.1:${p}/api/ext/auto-pair`, {
          method: "POST"
        });
        if (res.ok) {
          const body = await res.json();
          if (body.token) {
            this.peerTokens.set(p, body.token);
            return body.token;
          }
        }
      } catch {
      }
      return null;
    }
    async send(msg) {
      let sentWs = false;
      if (this.socket && this.socket.readyState === OPEN && this.authed) {
        try {
          this.socket.send(JSON.stringify(msg));
          sentWs = true;
        } catch {
          sentWs = false;
        }
      }
      if (!sentWs) await this.postIngest(msg);
      for (const p of await this.livePeers()) {
        try {
          const token = await this.ensurePeerToken(p);
          if (token) {
            void this.deps.fetch(`http://127.0.0.1:${p}/api/ext/ingest`, {
              method: "POST",
              headers: {
                "content-type": "application/json",
                authorization: `Bearer ${token}`
              },
              body: JSON.stringify(msg)
            }).catch(() => void 0);
          }
        } catch {
        }
      }
    }
    /** Other Studio instances on this machine, refreshed at most every PEER_PROBE_MS. */
    async livePeers() {
      const now = this.deps.now();
      if (this.peerProbeAt !== null && now - this.peerProbeAt < PEER_PROBE_MS) return this.peerPorts;
      const candidates = [4e3, 4001, 4002, 4003, 4004].filter((p) => p !== this.port);
      const alive = [];
      for (const p of candidates) {
        try {
          const res = await this.deps.fetch(`http://127.0.0.1:${p}/api/health`);
          if (res.ok) alive.push(p);
        } catch {
        }
      }
      this.peerPorts = alive;
      this.peerProbeAt = now;
      return alive;
    }
    async postIngest(msg) {
      if (!this.token) {
        await this.autoPair();
        if (!this.token) return;
      }
      const port = this.port ?? await this.discoverPort();
      if (port === null) return;
      try {
        const res = await this.deps.fetch(`http://127.0.0.1:${port}/api/ext/ingest`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${this.token}`
          },
          body: JSON.stringify(msg)
        });
        if (res.status === 401) {
          this.token = null;
          await this.deps.storage.remove("token");
          this.teardown(true);
          this.lastPairFailureAt = null;
          const rePaired = await this.autoPair();
          if (rePaired && this.token) {
            await this.deps.fetch(`http://127.0.0.1:${port}/api/ext/ingest`, {
              method: "POST",
              headers: {
                "content-type": "application/json",
                authorization: `Bearer ${this.token}`
              },
              body: JSON.stringify(msg)
            }).catch(() => void 0);
          }
        }
      } catch {
      }
    }
    async setPort(targetPort) {
      this.port = targetPort;
      await this.deps.storage.set("port", targetPort);
      this.token = null;
      await this.deps.storage.remove("token");
      this.teardown(true);
      return await this.autoPair();
    }
    async detectActivePorts() {
      const list = [4e3, 4001, 4002, 4003, 4004, 5175];
      const found = [];
      for (const p of list) {
        try {
          const res = await this.deps.fetch(`http://127.0.0.1:${p}/api/health`);
          if (res.ok) found.push(p);
        } catch {
        }
      }
      return found;
    }
    /** Cached port first, then 4002, 4000..4010 and dev ports. Verifies via GET /api/health. */
    async discoverPort() {
      if (this.discoveryInFlight) return this.discoveryInFlight;
      const now = this.deps.now();
      if (this.lastDiscoveryAt !== null && now - this.lastDiscoveryAt < DISCOVERY_COOLDOWN_MS) {
        return this.port;
      }
      const run = this.sweepPort().then((port) => {
        this.lastDiscoveryAt = this.deps.now();
        return port;
      });
      this.discoveryInFlight = run;
      try {
        return await run;
      } finally {
        if (this.discoveryInFlight === run) this.discoveryInFlight = null;
      }
    }
    async sweepPort() {
      const candidates = [];
      if (this.port !== null) candidates.push(this.port);
      for (const p of [4002, 4e3, 4001, 4003, 4004, 5175, 5174]) {
        if (!candidates.includes(p)) candidates.push(p);
      }
      for (let p = EXT_PORT_RANGE.from; p <= EXT_PORT_RANGE.to; p++) {
        if (!candidates.includes(p)) candidates.push(p);
      }
      for (const port of candidates) {
        for (const host of ["127.0.0.1", "localhost"]) {
          try {
            const res = await this.deps.fetch(`http://${host}:${port}/api/health`);
            if (res.ok) {
              const body = await res.json();
              if (body.ok) {
                const actualPort = typeof body.port === "number" && body.port > 0 ? body.port : port;
                this.port = actualPort;
                await this.deps.storage.set("port", actualPort);
                return actualPort;
              }
            }
          } catch {
          }
        }
      }
      return null;
    }
    async connect() {
      if (!this.token || this.socket) return;
      const port = await this.discoverPort();
      if (port === null) return this.scheduleReconnect();
      const socket = this.deps.createSocket(`ws://127.0.0.1:${port}/ext`);
      this.socket = socket;
      this.authed = false;
      socket.onopen = () => {
        socket.send(JSON.stringify({ type: "auth", token: this.token }));
      };
      socket.onmessage = (e) => this.onServerMessage(e.data);
      socket.onerror = () => void 0;
      socket.onclose = (e) => {
        const wasThis = this.socket === socket;
        if (!wasThis) return;
        this.teardown(false);
        if (e.code === 4401) {
          void this.unpair();
          return;
        }
        this.scheduleReconnect();
      };
    }
    onServerMessage(data) {
      let json;
      try {
        json = JSON.parse(String(data));
      } catch {
        return;
      }
      const msg = ExtServerMessageSchema.safeParse(json);
      if (!msg.success) return;
      if (msg.data.type === "authed") {
        this.authed = true;
        this.backoff = BACKOFF_START_MS;
        this.startTimers();
        this.sendHeartbeat();
      } else if (msg.data.type === "command") {
        void this.handleCommand(msg.data).catch(
          (err) => console.warn("[StumpCast] command failed", err)
        );
      }
    }
    startTimers() {
      this.stopTimers();
      this.heartbeatTimer = this.deps.timers.setInterval(() => this.sendHeartbeat(), HEARTBEAT_MS);
      this.pingTimer = this.deps.timers.setInterval(() => {
        if (this.socket?.readyState === OPEN) this.socket.send(JSON.stringify({ type: "ping" }));
      }, PING_MS);
    }
    stopTimers() {
      if (this.heartbeatTimer !== null) this.deps.timers.clearInterval(this.heartbeatTimer);
      if (this.pingTimer !== null) this.deps.timers.clearInterval(this.pingTimer);
      this.heartbeatTimer = this.pingTimer = null;
    }
    sendHeartbeat() {
      if (this.killed) return;
      void this.send({
        type: "heartbeat",
        extensionVersion: this.deps.version,
        selectorsVersion: this.activeSelectorsVersion ?? this.deps.selectorsVersion(),
        tabs: this.tabs
      });
    }
    async reloadSelectors() {
      const port = await this.discoverPort();
      if (port === null) return false;
      for (const host of ["127.0.0.1", "localhost"]) {
        try {
          const res = await this.deps.fetch(`http://${host}:${port}/api/ext/selectors`);
          if (!res.ok) continue;
          const json = await res.json();
          const verified = await verifySignedSelectorBundle(json, DEFAULT_SELECTORS_PUBLIC_KEY);
          if (!verified.valid || !verified.bundle) {
            return false;
          }
          for (const [site, config] of Object.entries(verified.bundle.selectors)) {
            if (site !== "cricbuzz" && site !== "crex") return false;
            try {
              SelectorConfigSchema.parse(config);
            } catch {
              return false;
            }
          }
          this.activeSelectorsVersion = verified.bundle.version;
          await this.deps.storage.set("customSelectors", verified.bundle);
          this.deps.onReloadSelectors?.();
          return true;
        } catch {
        }
      }
      return false;
    }
    scheduleReconnect() {
      if (this.reconnectTimer !== null || this.killed) return;
      const delay = this.backoff;
      this.backoff = Math.min(this.backoff * 2, BACKOFF_MAX_MS);
      this.lastDiscoveryAt = null;
      this.peerProbeAt = null;
      this.reconnectTimer = this.deps.timers.setTimeout(() => {
        this.reconnectTimer = null;
        if (this.token) {
          void this.connect();
        } else {
          void this.autoPair();
        }
      }, delay);
    }
    teardown(closeSocket) {
      this.stopTimers();
      if (this.reconnectTimer !== null && closeSocket) {
        this.deps.timers.clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      const s = this.socket;
      this.socket = null;
      this.authed = false;
      if (s && closeSocket) {
        s.onclose = null;
        s.close();
      }
    }
    /** Keep-alive hook (chrome.alarms): reconnect if the socket silently died. */
    async ensureConnected() {
      await this.init();
      if (this.killed) return;
      if (this.token && (!this.socket || this.socket.readyState > OPEN)) {
        this.teardown(false);
        await this.connect();
      } else if (!this.token) {
        await this.autoPair();
      }
    }
    // ---- commands ---------------------------------------------------------------------------
    async handleCommand(cmd) {
      switch (cmd.command) {
        case "openMatch": {
          if (this.killed || !isAllowedMatchUrl(cmd.url)) return;
          await this.deps.tabs.open(cmd.url);
          return;
        }
        case "focusMatch": {
          const t = this.tracked.get(cmd.matchId);
          if (t?.tabId != null) await this.deps.tabs.focus(t.tabId);
          return;
        }
        case "closeMatch": {
          const t = this.tracked.get(cmd.matchId);
          try {
            if (t?.tabId != null) await this.deps.tabs.close(t.tabId);
          } finally {
            this.tracked.delete(cmd.matchId);
            this.persistTracked();
          }
          return;
        }
        case "reloadSelectors":
          await this.reloadSelectors();
          return;
        case "killSwitch":
          this.killed = cmd.enabled;
          await this.deps.storage.set("killed", cmd.enabled);
          return;
      }
    }
  };
  var isAllowedMatchUrl = (raw) => {
    try {
      const u = new URL(raw);
      return u.protocol === "https:" && ALLOWED_HOSTS.some((re) => re.test(u.hostname));
    } catch {
      return false;
    }
  };

  // src/background/worker.ts
  var chromeTabs = {
    async open(url) {
      const win = await chrome.windows.create({
        url,
        state: "minimized",
        focused: false,
        type: "normal"
      });
      const tab = win?.tabs?.[0];
      if (tab?.id == null) return null;
      await chrome.tabs.update(tab.id, { pinned: true, autoDiscardable: false });
      return tab.id;
    },
    async focus(tabId) {
      const tab = await chrome.tabs.get(tabId);
      await chrome.tabs.update(tabId, { active: true });
      if (tab.windowId != null) await chrome.windows.update(tab.windowId, { focused: true });
    },
    async close(tabId) {
      await chrome.tabs.remove(tabId);
    }
  };
  var connector = new Connector({
    storage: {
      async get(key) {
        return (await chrome.storage.local.get(key))[key];
      },
      async set(key, value) {
        await chrome.storage.local.set({ [key]: value });
      },
      async remove(key) {
        await chrome.storage.local.remove(key);
      }
    },
    fetch: (url, init) => fetch(url, init),
    createSocket: (url) => new WebSocket(url),
    tabs: chromeTabs,
    timers: {
      setInterval: (fn, ms) => setInterval(fn, ms),
      clearInterval: (id) => clearInterval(id),
      setTimeout: (fn, ms) => setTimeout(fn, ms),
      clearTimeout: (id) => clearTimeout(id)
    },
    now: () => Date.now(),
    version: chrome.runtime.getManifest().version,
    selectorsVersion: () => cricbuzzConfig.version
  });
  void connector.init();
  void chrome.alarms.create("keepalive", { periodInMinutes: 0.5 });
  chrome.alarms.onAlarm.addListener((a) => {
    if (a.name === "keepalive") void connector.ensureConnected();
  });
  chrome.runtime.onStartup.addListener(() => void connector.init());
  chrome.runtime.onInstalled.addListener(() => void connector.init());
  chrome.action.onClicked.addListener(() => void chrome.runtime.openOptionsPage());
  chrome.tabs.onRemoved.addListener((tabId) => connector.onTabRemoved(tabId));
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    const m = msg;
    if (m.type === "pair" && typeof m.code === "string") {
      void connector.pair(m.code).then((ok) => sendResponse({ ok }));
      return true;
    }
    if (m.type === "auto-pair") {
      void connector.autoPair().then((ok) => sendResponse({ ok }));
      return true;
    }
    if (m.type === "unpair") {
      void connector.unpair().then(() => sendResponse({ ok: true }));
      return true;
    }
    if (m.type === "set-port" && typeof msg.port === "number") {
      void connector.setPort(msg.port).then((ok) => sendResponse({ ok, port: connector.boundPort }));
      return true;
    }
    if (m.type === "detect-ports") {
      void connector.detectActivePorts().then((ports) => sendResponse({ ports }));
      return true;
    }
    if (m.type === "status") {
      void Promise.all([
        chrome.storage.local.get("readingPaused"),
        connector.detectActivePorts()
      ]).then(
        ([{ readingPaused }, detectedPorts]) => sendResponse({
          paired: connector.paired,
          tabs: connector.tabs,
          readingPaused: readingPaused === true,
          port: connector.boundPort,
          detectedPorts
        })
      );
      return true;
    }
    if (["score-update", "tick", "adapter-degraded"].includes(m.type ?? "")) {
      void connector.init().then(() => connector.onContentMessage(msg, sender.tab?.id ?? null)).then(() => sendResponse({ ok: true })).catch((err) => sendResponse({ ok: false, error: String(err) }));
      return true;
    }
    return false;
  });
})();
