declare module '@ckeditor/ckeditor5-react' {
    import ClassicEditor from '@ckeditor/ckeditor5-build-classic';
    import Event from '@ckeditor/ckeditor5-utils/src/eventinfo'
    import * as React from 'react';
    
    interface ExtendedEditorConfig {
        toolbar?: {
            items?: string[];
        };
        fontSize?: {
            options?: (number | string)[];
        };
        fontFamily?: {
            options?: string[];
        };
        fontColor?: {
            colors?: Array<{
                color: string;
                label: string;
            }>;
        };
        fontBackgroundColor?: {
            colors?: Array<{
                color: string;
                label: string;
            }>;
        };
        table?: {
            contentToolbar?: string[];
        };
        image?: {
            toolbar?: string[];
        };
        [key: string]: any;
    }
    
    const CKEditor: React.FunctionComponent<{
        disabled?: boolean;
        editor: typeof ClassicEditor;
        data?: string;
        id?: string;
        config?: ExtendedEditorConfig;
        onReady?: (editor: ClassicEditor) => void;
        onChange?: (event: Event, editor: ClassicEditor) => void;
        onBlur?: (event: Event, editor: ClassicEditor) => void;
        onFocus?: (event: Event, editor: ClassicEditor) => void;
        onError?: (error: Error) => void;
    }>;
    
    export { CKEditor };
}

declare module '@ckeditor/ckeditor5-build-classic' {
    const ClassicEditor: any;
    export = ClassicEditor;}