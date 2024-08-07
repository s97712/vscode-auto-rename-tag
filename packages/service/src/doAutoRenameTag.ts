import { getMatchingTagPairs } from './getMatchingTagPairs';
import {
  createScannerFast,
  ScannerStateFast
} from './htmlScanner/htmlScannerFast';
import { isSelfClosingTagInLanguage } from './isSelfClosingTag';
import { getNextClosingTagName } from './util/getNextClosingTagName';
import { getPreviousOpeningTagName } from './util/getPreviousOpenTagName';

export const doAutoRenameTag: (
  text: string,
  offset: number,
  newWord: string,
  oldWord: string,
  languageId: string
) =>
  | {
      startOffset: number;
      endOffset: number;
      tagName: string;
    }
  | undefined = (text, offset, newWord, oldWord, languageId) => {
  const matchingTagPairs = getMatchingTagPairs(languageId);
  const isSelfClosingTag = isSelfClosingTagInLanguage(languageId);
  const isReact =
    languageId === 'javascript' ||
    languageId === 'typescript' ||
    languageId === 'javascriptreact' ||
    languageId === 'typescriptreact';
  const scanner = createScannerFast({
    input: text,
    initialOffset: 0,
    initialState: ScannerStateFast.WithinContent,
    matchingTagPairs
  });
  if (newWord.startsWith('</')) {
    scanner.stream.goTo(offset);
    const tagName = newWord.slice(2);
    const oldTagName = oldWord.slice(2);
    const parent = getPreviousOpeningTagName(
      scanner,
      scanner.stream.position,
      isSelfClosingTag,
      isReact
    );
    if (!parent) {
      return undefined;
    }
    if (parent.tagName === tagName) {
      return undefined;
    }
    if (parent.tagName !== oldTagName) {
      return undefined;
    }
    if (!parent.seenRightAngleBracket) {
      return undefined;
    }
    const startOffset = parent.offset;
    const endOffset = parent.offset + parent.tagName.length;
    return {
      startOffset,
      endOffset,
      tagName
    };
  } else {
    scanner.stream.goTo(offset + 1);
    const tagName = newWord.slice(1);
    const oldTagName = oldWord.slice(1);
    const hasAdvanced = scanner.stream.advanceUntilEitherChar(
      ['<', '>'],
      true,
      isReact
    );
    // if start tag is not closed, return undefined
    if (scanner.stream.peekRight(0) === '<') {
      return undefined;
    }
    if (!hasAdvanced) {
      return undefined;
    }
    if (scanner.stream.peekLeft(1) === '/') {
      return undefined;
    }
    const possibleEndOfStartTag = scanner.stream.position;
    // check if we might be at an end tag
    while (scanner.stream.peekLeft(1).match(/[a-zA-Z\-\:]/)) {
      scanner.stream.goBack(1);
      if (scanner.stream.peekLeft(1) === '/') {
        return undefined;
      }
    }
    scanner.stream.goTo(possibleEndOfStartTag);
    scanner.stream.advance(1);
    const nextClosingTag = getNextClosingTagName(
      scanner,
      scanner.stream.position,
      isSelfClosingTag,
      isReact
    );
    if (!nextClosingTag) {
      return undefined;
    }
    if (nextClosingTag.tagName === tagName) {
      return undefined;
    }
    if (nextClosingTag.tagName !== oldTagName) {
      return undefined;
    }
    const previousOpenTag = getPreviousOpeningTagName(
      scanner,
      offset,
      isSelfClosingTag,
      isReact
    );

    if (
      previousOpenTag &&
      previousOpenTag.tagName === oldTagName &&
      previousOpenTag.indent === nextClosingTag.indent
    ) {
      return undefined;
    }

    const startOffset = nextClosingTag.offset;
    const endOffset = nextClosingTag.offset + nextClosingTag.tagName.length;

    return {
      startOffset,
      endOffset,
      tagName
    };
  }
};

// const testCase = {
//   text: '<div>\n  <di>\n  <div></div>\n</div>',
//   offset: 8,
//   newWord: '<di',
//   oldWord: '<div'
// };
// doAutoRenameTag(
//   testCase.text,
//   testCase.offset,
//   testCase.newWord,
//   testCase.oldWord,
//   'html'
// ); //?

// doAutoRenameTag(
//   `<div>
//   <div>
//   <div></div>
// </div>`,
//   9,
//   '<span',
//   '<div',
//   'html'
// ); //?
