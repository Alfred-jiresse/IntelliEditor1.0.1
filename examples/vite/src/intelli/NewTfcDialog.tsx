// « Nouveau TFC » — the cover-page form that generates a norm-conforming skeleton.
//
// Fields default to the UDBL template; the generated document is styled from the ACTIVE
// profile, so it satisfies exactly the norm the panel checks. The logo defaults to the UDBL
// one shipped with the app (same origin); the user may pick another file or remove it.

import { useEffect, useState, type FormEvent } from 'react';
import {
  createTfcTemplate,
  DEFAULT_COVER,
  type ConformityProfile,
  type CoverLogo,
  type CoverMetadata,
} from '@intellieditor/conformity';
import { fetchDefaultLogo } from './samples';

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

type TextField = Exclude<keyof CoverMetadata, 'logo'>;

const FIELDS: readonly {
  readonly key: TextField;
  readonly label: string;
  readonly wide?: boolean;
}[] = [
  { key: 'title', label: 'Thème du travail', wide: true },
  { key: 'subtitle', label: 'Sous-titre (cas d’application)', wide: true },
  { key: 'author', label: 'Nom, post-nom et prénom' },
  { key: 'field', label: 'Filière' },
  { key: 'director', label: 'Directeur' },
  { key: 'coDirector', label: 'Co-directeur (facultatif)' },
  { key: 'degree', label: 'Grade visé (« du grade d’… »)', wide: true },
  { key: 'department', label: 'Département', wide: true },
  { key: 'faculty', label: 'Faculté' },
  { key: 'date', label: 'Mois et année' },
];

async function readLogo(file: File): Promise<CoverLogo | string> {
  if (file.size > MAX_LOGO_BYTES) return 'logo trop volumineux (2 Mo maximum)';
  const format = file.type === 'image/png' ? 'png' : file.type === 'image/jpeg' ? 'jpeg' : null;
  if (!format) return 'le logo doit être une image PNG ou JPEG';
  return { bytes: new Uint8Array(await file.arrayBuffer()), format };
}

interface NewTfcDialogProps {
  readonly profile: ConformityProfile;
  readonly onCreate: (bytes: Uint8Array, title: string) => void;
  readonly onClose: () => void;
}

export function NewTfcDialog({ profile, onCreate, onClose }: NewTfcDialogProps) {
  const [meta, setMeta] = useState<CoverMetadata>({
    ...DEFAULT_COVER,
    institution: profile.institution,
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void fetchDefaultLogo().then((logo) => {
      if (live && logo) setMeta((current) => (current.logo ? current : { ...current, logo }));
    });
    return () => {
      live = false;
    };
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!meta.title.trim() || !meta.author.trim()) {
      setError('Le thème et le nom de l’auteur sont obligatoires.');
      return;
    }
    onCreate(createTfcTemplate(meta, profile), meta.title.trim());
  };

  return (
    <div
      className="intelli-dialog__backdrop"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        className="intelli-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="intelli-new-tfc"
        onSubmit={submit}
      >
        <h2 id="intelli-new-tfc" className="intelli-dialog__title">
          Nouveau TFC
        </h2>
        <p className="intelli-dialog__intro">
          Génère un document déjà conforme à la norme « {profile.name} » : page de garde, pages
          liminaires, introduction structurée, chapitre type, table des matières automatique et
          numérotation des pages.
        </p>
        <div className="intelli-dialog__grid">
          {FIELDS.map(({ key, label, wide }) => (
            <label key={key} className={`intelli-field${wide ? ' intelli-field--wide' : ''}`}>
              <span className="intelli-field__label">{label}</span>
              <input
                className="intelli-field__input"
                value={meta[key]}
                maxLength={200}
                onChange={(event) => setMeta({ ...meta, [key]: event.target.value })}
              />
            </label>
          ))}
          <label className="intelli-field intelli-field--wide">
            <span className="intelli-field__label">
              Logo de l’université (PNG ou JPEG) —{' '}
              {meta.logo ? 'logo inclus (UDBL par défaut)' : 'aucun logo'}
            </span>
            <input
              className="intelli-field__input"
              type="file"
              accept="image/png,image/jpeg"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                void readLogo(file).then((logo) =>
                  typeof logo === 'string' ? setError(logo) : setMeta({ ...meta, logo })
                );
              }}
            />
            {meta.logo ? (
              <button
                type="button"
                className="intelli-button"
                onClick={() => setMeta({ ...meta, logo: undefined })}
              >
                Retirer le logo
              </button>
            ) : null}
          </label>
        </div>
        {error ? (
          <p className="intelli-panel__error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="intelli-dialog__actions">
          <button type="button" className="intelli-button" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="intelli-button intelli-button--primary">
            Créer le document
          </button>
        </div>
      </form>
    </div>
  );
}
