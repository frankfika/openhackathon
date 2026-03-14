import React from 'react'

type Props = {
  content: string
}

const INLINE_PATTERN = /(`[^`]+`)|(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)/g

function renderInlineMarkdown(text: string, keyPrefix: string) {
  const nodes: React.ReactNode[] = []
  let lastIndex = 0

  for (const match of text.matchAll(INLINE_PATTERN)) {
    const fullMatch = match[0]
    const startIndex = match.index || 0
    if (startIndex > lastIndex) {
      nodes.push(text.slice(lastIndex, startIndex))
    }

    if (match[1]) {
      nodes.push(
        <code key={`${keyPrefix}-code-${startIndex}`} className="rounded bg-foreground/8 px-1.5 py-0.5 font-mono text-[0.92em]">
          {fullMatch.slice(1, -1)}
        </code>
      )
    } else if (match[2]) {
      nodes.push(
        <a
          key={`${keyPrefix}-link-${startIndex}`}
          href={match[4]}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-primary underline underline-offset-4"
        >
          {match[3]}
        </a>
      )
    } else if (match[5]) {
      nodes.push(<strong key={`${keyPrefix}-strong-${startIndex}`}>{match[6]}</strong>)
    } else if (match[7]) {
      nodes.push(<em key={`${keyPrefix}-em-${startIndex}`}>{match[8]}</em>)
    }

    lastIndex = startIndex + fullMatch.length
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }

  return nodes
}

export function MarkdownDocument({ content }: Props) {
  const blocks: React.ReactNode[] = []
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  let paragraphLines: string[] = []
  let unorderedItems: string[] = []
  let orderedItems: string[] = []
  let quoteLines: string[] = []
  let codeFenceLanguage = ''
  let codeFenceLines: string[] = []

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return
    const text = paragraphLines.join(' ')
    blocks.push(
      <p key={`paragraph-${blocks.length}`} className="text-sm leading-7 text-foreground/88">
        {renderInlineMarkdown(text, `paragraph-${blocks.length}`)}
      </p>
    )
    paragraphLines = []
  }

  const flushUnorderedList = () => {
    if (unorderedItems.length === 0) return
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="list-disc space-y-2 pl-6 text-sm leading-7 text-foreground/88">
        {unorderedItems.map((item, index) => (
          <li key={`ul-${blocks.length}-${index}`}>{renderInlineMarkdown(item, `ul-${blocks.length}-${index}`)}</li>
        ))}
      </ul>
    )
    unorderedItems = []
  }

  const flushOrderedList = () => {
    if (orderedItems.length === 0) return
    blocks.push(
      <ol key={`ol-${blocks.length}`} className="list-decimal space-y-2 pl-6 text-sm leading-7 text-foreground/88">
        {orderedItems.map((item, index) => (
          <li key={`ol-${blocks.length}-${index}`}>{renderInlineMarkdown(item, `ol-${blocks.length}-${index}`)}</li>
        ))}
      </ol>
    )
    orderedItems = []
  }

  const flushQuote = () => {
    if (quoteLines.length === 0) return
    blocks.push(
      <blockquote key={`quote-${blocks.length}`} className="border-l-4 border-primary/30 pl-4 text-sm leading-7 text-muted-foreground">
        {renderInlineMarkdown(quoteLines.join(' '), `quote-${blocks.length}`)}
      </blockquote>
    )
    quoteLines = []
  }

  const flushCodeFence = () => {
    if (codeFenceLines.length === 0 && !codeFenceLanguage) return
    blocks.push(
      <div key={`code-${blocks.length}`} className="overflow-hidden rounded-2xl border border-border/70 bg-slate-950/95 text-slate-100">
        {codeFenceLanguage ? (
          <div className="border-b border-slate-800 px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
            {codeFenceLanguage}
          </div>
        ) : null}
        <pre className="overflow-x-auto px-4 py-4 text-xs leading-6">
          <code>{codeFenceLines.join('\n')}</code>
        </pre>
      </div>
    )
    codeFenceLanguage = ''
    codeFenceLines = []
  }

  const flushAll = () => {
    flushParagraph()
    flushUnorderedList()
    flushOrderedList()
    flushQuote()
  }

  for (const line of lines) {
    if (codeFenceLanguage || codeFenceLines.length > 0) {
      if (line.trim().startsWith('```')) {
        flushCodeFence()
      } else {
        codeFenceLines.push(line)
      }
      continue
    }

    const trimmed = line.trim()
    if (!trimmed) {
      flushAll()
      continue
    }

    const fenceMatch = trimmed.match(/^```(.*)$/)
    if (fenceMatch) {
      flushAll()
      codeFenceLanguage = fenceMatch[1].trim()
      codeFenceLines = []
      continue
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/)
    if (headingMatch) {
      flushAll()
      const level = headingMatch[1].length
      const contentText = headingMatch[2]
      const classes = [
        'font-semibold tracking-tight text-foreground',
        level === 1 ? 'text-3xl md:text-4xl' : '',
        level === 2 ? 'text-2xl md:text-3xl' : '',
        level === 3 ? 'text-xl md:text-2xl' : '',
        level >= 4 ? 'text-lg' : '',
      ].join(' ')
      blocks.push(
        React.createElement(
          `h${Math.min(level, 6)}`,
          { key: `heading-${blocks.length}`, className: classes },
          renderInlineMarkdown(contentText, `heading-${blocks.length}`)
        )
      )
      continue
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushAll()
      blocks.push(<hr key={`hr-${blocks.length}`} className="border-border/60" />)
      continue
    }

    const unorderedMatch = trimmed.match(/^[-*]\s+(.*)$/)
    if (unorderedMatch) {
      flushParagraph()
      flushOrderedList()
      flushQuote()
      unorderedItems.push(unorderedMatch[1])
      continue
    }

    const orderedMatch = trimmed.match(/^\d+\.\s+(.*)$/)
    if (orderedMatch) {
      flushParagraph()
      flushUnorderedList()
      flushQuote()
      orderedItems.push(orderedMatch[1])
      continue
    }

    const quoteMatch = trimmed.match(/^>\s?(.*)$/)
    if (quoteMatch) {
      flushParagraph()
      flushUnorderedList()
      flushOrderedList()
      quoteLines.push(quoteMatch[1])
      continue
    }

    flushUnorderedList()
    flushOrderedList()
    flushQuote()
    paragraphLines.push(trimmed)
  }

  flushAll()
  flushCodeFence()

  return <div className="space-y-5">{blocks}</div>
}
