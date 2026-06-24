import { Document } from '../../types/workspace'

export function getDocumentSummary(document: Document) {
  return {
    id: document.id,
    name: document.name,
    contentLength: document.content.length,
    preview: document.content.slice(0, 500),
    metadata: document.metadata,
  }
}

export function appendToDocument(document: Document, text: string): Document {
  const now = new Date().toISOString()
  return {
    ...document,
    content: document.content + text,
    metadata: { ...document.metadata, updatedAt: now },
  }
}

export function replaceDocumentSection(
  document: Document,
  heading: string,
  newContent: string
): Document {
  const now = new Date().toISOString()
  const sectionHeader = `## ${heading}`
  const idx = document.content.indexOf(sectionHeader)

  if (idx === -1) {
    const addition = document.content.endsWith('\n') || document.content.length === 0
      ? `${sectionHeader}\n${newContent}\n`
      : `\n\n${sectionHeader}\n${newContent}\n`
    return {
      ...document,
      content: document.content + addition,
      metadata: { ...document.metadata, updatedAt: now },
    }
  }

  const afterHeader = idx + sectionHeader.length
  const nextHeading = document.content.indexOf('\n## ', afterHeader)
  const end = nextHeading === -1 ? document.content.length : nextHeading
  const before = document.content.slice(0, afterHeader)
  const after = document.content.slice(end)
  const content = `${before}\n${newContent}\n${after}`.replace(/\n{3,}/g, '\n\n')

  return {
    ...document,
    content,
    metadata: { ...document.metadata, updatedAt: now },
  }
}

export function findDocumentsByName(documents: Document[], query: string): Document[] {
  const q = query.toLowerCase()
  return documents.filter((d) => d.name.toLowerCase().includes(q))
}

export const DOCUMENT_TEMPLATES = {
  system_architecture: `# System Architecture

## Overview

## Block Diagram

## Subsystems

## Component Selection Rationale

## Power Budget

## Communications

`,
  comms_protocol: `# Communications Protocol Specification

## Transport

## Message Format

## Commands

## Error Handling

`,
  assembly_guide: `# Assembly & Bring-Up Guide

## Tools Required

## Wiring / Soldering Steps

## Firmware Flash

## Bring-Up Checklist

`,
  elicitation_summary: `# Project Requirements Summary

## Use Case & Environment

## Power & Battery

## Communications

## Display

## Scale & Budget

## Enclosure

`,
} as const

export type DocumentTemplateId = keyof typeof DOCUMENT_TEMPLATES
