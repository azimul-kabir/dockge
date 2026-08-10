import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";

const lightEditorTheme = EditorView.theme({
    "&": {
        color: "#212529",
        backgroundColor: "#f8f9fa",
    },
    ".cm-content": {
        caretColor: "#212529",
    },
    ".cm-cursor, .cm-dropCursor": {
        borderLeftColor: "#212529",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
        backgroundColor: "#b6d4fe",
    },
    ".cm-activeLine": {
        backgroundColor: "#e9ecef80",
    },
    ".cm-gutters": {
        color: "#6c757d",
        backgroundColor: "#f1f3f5",
        borderRight: "1px solid #dee2e6",
    },
    ".cm-activeLineGutter": {
        color: "#343a40",
        backgroundColor: "#e2e6ea",
    },
    "&.cm-editor.cm-focused": {
        outline: "1px solid #86b7fe",
    },
    "&.cm-editor.cm-disabled": {
        opacity: "1",
    },
}, { dark: false });

const lightHighlightStyle = HighlightStyle.define([
    { tag: [ tags.keyword, tags.bool, tags.null ],
        color: "#6f42c1" },
    { tag: [ tags.name, tags.propertyName, tags.attributeName ],
        color: "#075985" },
    { tag: [ tags.string, tags.special(tags.string) ],
        color: "#116329" },
    { tag: [ tags.number, tags.integer, tags.float ],
        color: "#a33a00" },
    { tag: [ tags.comment, tags.lineComment, tags.blockComment ],
        color: "#66707a",
        fontStyle: "italic" },
    { tag: [ tags.punctuation, tags.separator, tags.bracket ],
        color: "#495057" },
    { tag: [ tags.operator, tags.definitionOperator ],
        color: "#9c2f5f" },
    { tag: [ tags.variableName, tags.definition(tags.variableName) ],
        color: "#075985" },
    { tag: tags.invalid,
        color: "#b02a37",
        textDecoration: "underline" },
]);

export const lightCodeMirrorTheme = [
    lightEditorTheme,
    syntaxHighlighting(lightHighlightStyle),
];
