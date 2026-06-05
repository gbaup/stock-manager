'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FormHead } from '@/components/ui/chrome';
import { Swatch } from '@/components/ui/swatch';
import { Field, TextInput, SelectInput, TextAreaInput, ColorPicker } from '@/components/ui/field';
import { VERSIONS } from '@/app/lib/domain';
import type { ModelWithStats } from '@/app/lib/domain';
import { createModel, updateModel } from '@/app/actions/models';

type FormState = {
  team: string; season: string; version: string;
  color: string; number: string; player: string; description: string;
};

export function ModelForm({ initial }: { initial?: ModelWithStats | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [f, setF] = useState<FormState>({
    team: initial?.team ?? '',
    season: initial?.season ?? '',
    version: initial?.version ?? 'Home',
    color: initial?.color ?? 'Blanco',
    number: initial?.number ?? '',
    player: initial?.player ?? '',
    description: initial?.description ?? '',
  });
  const set = (k: keyof FormState, v: string) => setF((s) => ({ ...s, [k]: v }));
  const canSave = f.team.trim().length > 0 && f.season.trim().length > 0;

  function handleSave() {
    if (!canSave) return;
    const fd = new FormData();
    Object.entries(f).forEach(([k, v]) => fd.set(k, v));
    startTransition(async () => {
      if (initial?.id) {
        await updateModel(initial.id, undefined, fd);
      } else {
        await createModel(undefined, fd);
      }
    });
  }

  return (
    <div className="screen">
      <FormHead
        onCancel={() => router.back()}
        title={initial ? 'Editar modelo' : 'Nuevo modelo'}
        onSave={handleSave}
        saveLabel={initial ? 'Guardar cambios' : 'Crear modelo'}
        canSave={canSave && !pending}
      />
      <div className="body">
        <div className="body-pad">
          <div style={{ display: 'flex', justifyContent: 'center', margin: '10px 0 18px' }}>
            <Swatch color={f.color} number={f.number} style={{ width: 84, height: 96, fontSize: 32 }} />
          </div>

          <div className="section-label">Identificación</div>
          <Field label="Equipo">
            <TextInput value={f.team} onChange={(v) => set('team', v)} placeholder="Ej: Nacional, Real Madrid…" />
          </Field>
          <div className="field-row">
            <Field label="Temporada">
              <TextInput value={f.season} onChange={(v) => set('season', v)} placeholder="2025/26" mono />
            </Field>
            <Field label="Versión">
              <SelectInput value={f.version} onChange={(v) => set('version', v)} options={VERSIONS} />
            </Field>
          </div>

          <div className="section-label">Apariencia</div>
          <Field label="Color principal">
            <ColorPicker value={f.color} onChange={(v) => set('color', v)} />
          </Field>
          <div className="field-row">
            <Field label="Número" optional>
              <TextInput
                value={f.number}
                onChange={(v) => set('number', v.replace(/[^\d]/g, '').slice(0, 2))}
                placeholder="10"
                mono
                inputMode="numeric"
              />
            </Field>
            <Field label="Jugador" optional>
              <TextInput value={f.player} onChange={(v) => set('player', v)} placeholder="Ej: Messi" />
            </Field>
          </div>

          <div className="section-label">Notas</div>
          <Field label="Descripción" optional>
            <TextAreaInput
              value={f.description}
              onChange={(v) => set('description', v)}
              placeholder="Detalles, edición especial, observaciones…"
            />
          </Field>

          <button className="btn btn-primary" style={{ marginTop: 14 }} disabled={!canSave || pending} onClick={handleSave}>
            {initial ? 'Guardar cambios' : 'Crear modelo'}
          </button>
        </div>
      </div>
    </div>
  );
}
