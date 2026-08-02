import type { AuditKingMatch, AuditKingStateModel } from "./models";
import type { AuditKingRuntime } from "./runtime";

export interface AuditKingAppContext {
    runtime: AuditKingRuntime;
    state: AuditKingStateModel;
    getElement<T extends HTMLElement>(id: string): T;
    recomputeSearch(): void;
    refresh(message?: string, type?: "info" | "success" | "error"): void;
    getFilteredMatches(): AuditKingMatch[];
    getCurrentFilteredMatch(): AuditKingMatch | null;
    focusMatch(index: number): void;
    formatLocalDate(date: Date): string;
}

export function createAppContext(runtime: AuditKingRuntime): AuditKingAppContext {
        const state: AuditKingStateModel = runtime.State.createState();

        function getElement<T extends HTMLElement>(id: string): T {
            return runtime.View.getElement(id) as T;
        }

        function recomputeSearch(): void {
            const enabledDocuments = runtime.State.getEnabledDocuments
                ? runtime.State.getEnabledDocuments(state)
                : state.documents.filter((documentItem) => documentItem.enabled !== false);
            const result = state.documentIndex
                ? runtime.SearchEngine.searchIndex(state.documentIndex, state.checkItems)
                : runtime.SearchEngine.searchDocuments(enabledDocuments, state.checkItems);
            runtime.State.setSearchResult(state, result);
        }

        function refresh(message = "", type: "info" | "success" | "error" = "info"): void {
            runtime.View.renderAll(state);
            if (message) {
                runtime.View.renderStatus(message, type);
            }
        }

        function getFilteredMatches(): AuditKingMatch[] {
            return runtime.SearchEngine.filterMatches(state.searchResult.matches, {
                checkItemId: state.currentCheckItemId,
                documentId: state.documentFilterId
            });
        }

        function getCurrentFilteredMatch(): AuditKingMatch | null {
            const matches = getFilteredMatches();
            return matches[Math.max(0, Math.min(matches.length - 1, state.currentMatchIndex))] || null;
        }

        function focusMatch(index: number): void {
            const matches = getFilteredMatches();
            if (!matches.length) return;
            const nextIndex = Math.max(0, Math.min(matches.length - 1, index));
            if (nextIndex !== state.currentMatchIndex) {
                runtime.State.resetMatchDetailContext(state);
            }
            state.currentMatchIndex = nextIndex;
            runtime.View.renderMatches(state);
        }

        function formatLocalDate(date: Date): string {
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        }

        return {
            runtime,
            state,
            getElement,
            recomputeSearch,
            refresh,
            getFilteredMatches,
            getCurrentFilteredMatch,
            focusMatch,
            formatLocalDate
        };
    }
