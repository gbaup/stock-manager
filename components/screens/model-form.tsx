'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormHead } from '@/components/ui/chrome';
import { Field, TextInput, SelectInput, TextAreaInput, ColorPicker, TeamCombobox } from '@/components/ui/field';
import { Segmented } from '@/components/ui/segmented';
import { PhotoGallery } from '@/components/ui/photo-gallery';
import { VERSIONS, SHIRT_TYPES, SLEEVES } from '@/app/lib/domain';
import type { ModelWithStats } from '@/app/lib/domain';
import { createModel, updateModel } from '@/app/actions/models';
import { createTeam } from '@/app/actions/teams';
import { modelSchema, type ModelFormValues } from '@/app/lib/schemas';

export function ModelForm({
  initial,
  teams,
}: {
  initial?: ModelWithStats | null;
  teams: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ModelFormValues>({
    resolver: zodResolver(modelSchema),
    defaultValues: {
      teamId: initial ? (teams.find((t) => t.name === initial.team)?.id ?? '') : '',
      season: initial?.season ?? '',
      version: initial?.version ?? 'Home',
      type: initial?.type ?? 'Fan',
      sleeve: initial?.sleeve ?? 'Corta',
      color: initial?.color ?? 'Blanco',
      number: initial?.number ?? '',
      player: initial?.player ?? '',
      description: initial?.description ?? '',
      photos: initial?.photos ?? [],
    },
  });

  const color = useWatch({ control, name: 'color' });
  const number = useWatch({ control, name: 'number' });

  function onSubmit(data: ModelFormValues) {
    const fd = new FormData();
    fd.set('teamId', data.teamId);
    fd.set('season', data.season);
    fd.set('version', data.version);
    fd.set('type', data.type);
    fd.set('sleeve', data.sleeve);
    fd.set('color', data.color);
    fd.set('number', data.number ?? '');
    fd.set('player', data.player ?? '');
    fd.set('description', data.description ?? '');
    fd.set('photos', JSON.stringify(data.photos));
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
        onSave={handleSubmit(onSubmit)}
        saveLabel={initial ? 'Guardar cambios' : 'Crear modelo'}
        canSave={!pending}
      />
      <div className="body">
        <div className="body-pad">
          <Controller
            name="photos"
            control={control}
            render={({ field }) => (
              <PhotoGallery
                photos={field.value}
                color={color}
                number={number ?? ''}
                onChange={field.onChange}
              />
            )}
          />

          <div className="section-label">Identificación</div>
          <Field label="Equipo" error={errors.teamId?.message}>
            <Controller
              name="teamId"
              control={control}
              render={({ field }) => (
                <TeamCombobox
                  value={field.value}
                  onChange={field.onChange}
                  teams={teams}
                  onCreateTeam={createTeam}
                />
              )}
            />
          </Field>
          <div className="field-row">
            <Field label="Temporada" error={errors.season?.message}>
              <Controller
                name="season"
                control={control}
                render={({ field }) => (
                  <TextInput value={field.value} onChange={field.onChange} placeholder="2025/26" mono />
                )}
              />
            </Field>
            <Field label="Versión">
              <Controller
                name="version"
                control={control}
                render={({ field }) => (
                  <SelectInput value={field.value} onChange={field.onChange} options={VERSIONS} />
                )}
              />
            </Field>
          </div>
          <Field label="Tipo">
            <Controller
              name="type"
              control={control}
              render={({ field }) => (
                <Segmented options={SHIRT_TYPES} value={field.value} onChange={field.onChange} full />
              )}
            />
          </Field>
          <Field label="Manga">
            <Controller
              name="sleeve"
              control={control}
              render={({ field }) => (
                <Segmented options={SLEEVES} value={field.value} onChange={field.onChange} full />
              )}
            />
          </Field>

          <div className="section-label">Apariencia</div>
          <Field label="Color principal">
            <Controller
              name="color"
              control={control}
              render={({ field }) => (
                <ColorPicker value={field.value} onChange={field.onChange} />
              )}
            />
          </Field>
          <div className="field-row">
            <Field label="Número" optional>
              <Controller
                name="number"
                control={control}
                render={({ field }) => (
                  <TextInput
                    value={field.value ?? ''}
                    onChange={(v) => field.onChange(v.replace(/[^\d]/g, '').slice(0, 2))}
                    placeholder="10"
                    mono
                    inputMode="numeric"
                  />
                )}
              />
            </Field>
            <Field label="Jugador" optional>
              <Controller
                name="player"
                control={control}
                render={({ field }) => (
                  <TextInput value={field.value ?? ''} onChange={field.onChange} placeholder="Ej: Messi" />
                )}
              />
            </Field>
          </div>

          <div className="section-label">Notas</div>
          <Field label="Descripción" optional>
            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <TextAreaInput
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  placeholder="Detalles, edición especial, observaciones…"
                />
              )}
            />
          </Field>

          <button className="btn btn-primary" style={{ marginTop: 14 }} disabled={pending} onClick={handleSubmit(onSubmit)}>
            {initial ? 'Guardar cambios' : 'Crear modelo'}
          </button>
        </div>
      </div>
    </div>
  );
}
