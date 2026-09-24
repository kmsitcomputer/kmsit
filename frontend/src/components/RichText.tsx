import { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import { MediaPicker } from './ui';
import { Icon } from './icons';

/** Tiptap rich-text editor — konten disimpan sebagai HTML (gambar → path/url, bukan binary). */
export default function RichText({ value, onChange, placeholder = 'Tulis di sini…' }: {
  value: string; onChange: (html: string) => void; placeholder?: string;
}) {
  const [mediaOpen, setMediaOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer' } }),
      Image,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: value || '',
    editorProps: {
      attributes: { class: 'tiptap', 'data-placeholder': placeholder },
    },
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
  });

  useEffect(() => {
    if (editor && (value === '' || value === '<p></p>') && editor.getHTML() !== value) editor.commands.setContent(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  if (!editor) return null;

  const btn = (active: boolean) =>
    `h-8 min-w-8 px-1.5 rounded-md text-xs font-bold flex items-center justify-center transition-colors cursor-pointer ${active ? 'bg-brand-500/15 text-brand-600 dark:text-brand-400' : 'text-base-500 hover:bg-base-100 dark:hover:bg-base-800 hover:text-base-800 dark:hover:text-base-200'}`;

  const addLink = () => {
    if (!linkUrl.trim()) { editor.chain().focus().unsetLink().run(); }
    else {
      const url = /^https?:\/\//i.test(linkUrl) ? linkUrl : `https://${linkUrl}`;
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
    setLinkOpen(false); setLinkUrl('');
  };

  return (
    <div className="overflow-hidden rounded-lg border border-base-300 dark:border-base-700 bg-white dark:bg-base-900 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/25 transition-all">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-base-200 dark:border-base-800 bg-base-50 dark:bg-base-850 px-2 py-1.5">
        <button type="button" className={btn(editor.isActive('bold'))} title="Bold" onClick={() => editor.chain().focus().toggleBold().run()}><span className="font-black">B</span></button>
        <button type="button" className={btn(editor.isActive('italic'))} title="Italic" onClick={() => editor.chain().focus().toggleItalic().run()}><span className="italic font-serif">I</span></button>
        <button type="button" className={btn(editor.isActive('underline'))} title="Underline" onClick={() => editor.chain().focus().toggleUnderline().run()}><span className="underline">U</span></button>
        <button type="button" className={btn(editor.isActive('strike'))} title="Strikethrough" onClick={() => editor.chain().focus().toggleStrike().run()}><span className="line-through">S</span></button>
        <span className="mx-1 h-5 w-px bg-base-200 dark:bg-base-700" />
        <button type="button" className={btn(editor.isActive('heading', { level: 1 }))} title="Heading 1" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</button>
        <button type="button" className={btn(editor.isActive('heading', { level: 2 }))} title="Heading 2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
        <button type="button" className={btn(editor.isActive('heading', { level: 3 }))} title="Heading 3" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</button>
        <button type="button" className={btn(editor.isActive('paragraph'))} title="Paragraf" onClick={() => editor.chain().focus().setParagraph().run()}><span className="font-mono">¶</span></button>
        <span className="mx-1 h-5 w-px bg-base-200 dark:bg-base-700" />
        <button type="button" className={btn(editor.isActive('bulletList'))} title="Bullet list" onClick={() => editor.chain().focus().toggleBulletList().run()}><Icon name="list" size={14} /></button>
        <button type="button" className={btn(editor.isActive('orderedList'))} title="Ordered list" onClick={() => editor.chain().focus().toggleOrderedList().run()}><span className="font-mono">1.</span></button>
        <button type="button" className={btn(editor.isActive('blockquote'))} title="Blockquote" onClick={() => editor.chain().focus().toggleBlockquote().run()}><span className="font-serif text-base leading-none">"</span></button>
        <button type="button" className={btn(editor.isActive('codeBlock'))} title="Code block" onClick={() => editor.chain().focus().toggleCodeBlock().run()}><Icon name="code" size={14} /></button>
        <button type="button" className={btn(false)} title="Horizontal rule" onClick={() => editor.chain().focus().setHorizontalRule().run()}><span className="font-mono">—</span></button>
        <span className="mx-1 h-5 w-px bg-base-200 dark:bg-base-700" />
        <button type="button" className={btn(editor.isActive('link'))} title="Link" onClick={() => { setLinkUrl(editor.getAttributes('link').href ?? ''); setLinkOpen(true); }}><Icon name="link" size={14} /></button>
        <button type="button" className={btn(false)} title="Gambar" onClick={() => setMediaOpen(true)}><Icon name="image" size={14} /></button>
        <button type="button" className={btn(editor.isActive({ textAlign: 'left' }))} title="Rata kiri" onClick={() => editor.chain().focus().setTextAlign('left').run()}><Icon name="menu" size={13} /></button>
        <button type="button" className={btn(editor.isActive({ textAlign: 'center' }))} title="Rata tengah" onClick={() => editor.chain().focus().setTextAlign('center').run()}><span className="font-mono text-[10px]">≡</span></button>
        <span className="mx-1 h-5 w-px bg-base-200 dark:bg-base-700" />
        <button type="button" className={btn(false)} title="Undo" onClick={() => editor.chain().focus().undo().run()}><Icon name="arrow-left" size={13} /></button>
        <button type="button" className={btn(false)} title="Redo" onClick={() => editor.chain().focus().redo().run()}><Icon name="arrow-right" size={13} /></button>
      </div>
      <EditorContent editor={editor} />
      <MediaPicker open={mediaOpen} onClose={() => setMediaOpen(false)}
        onPick={(url) => editor.chain().focus().setImage({ src: url }).run()} />
      {linkOpen && (
        <div className="flex items-center gap-2 border-t border-base-200 dark:border-base-800 bg-base-50 dark:bg-base-850 px-3 py-2">
          <input autoFocus value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addLink()}
            placeholder="https://…" className="input py-1.5 text-xs flex-1" />
          <button className="btn-primary btn-sm" onClick={addLink}>OK</button>
          <button className="btn-ghost btn-sm" onClick={() => { editor.chain().focus().unsetLink().run(); setLinkOpen(false); }}>Hapus</button>
        </div>
      )}
    </div>
  );
}
