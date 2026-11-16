import React from 'react';
import { useApp } from '../context/AppContext';

export const GuidePage: React.FC = () => {
  const { settings } = useApp();

  const sections = [
    {
      num: '01',
      title: 'Acceso, Roles y Protección de Datos',
      body: 'El sistema implementa cuatro perfiles: Administrador principal (control total y configuración), Administrador (gestión operativa y reportes), Coordinador (carga y consulta de estructura) y Usuario de consulta (solo lectura). Los datos personales sensibles (C.I. y teléfonos) se enmascaran automáticamente para usuarios sin autorización expresa.',
    },
    {
      num: '02',
      title: 'Configuración Territorial (18 Departamentos de Paraguay)',
      body: 'Desde el módulo Configuración Territorial puede activar o desactivar los 18 departamentos precargados, agregar distritos ilimitados por departamento y registrar números de seccionales. Al seleccionar un departamento en cualquier formulario, el sistema filtra automáticamente los distritos correspondientes.',
    },
    {
      num: '03',
      title: 'Coordinadores, Jóvenes y Mujeres',
      body: 'Cada estructura cuenta con su tabla independiente y validación automática de Cédula de Identidad (C.I.) para impedir registros duplicados. Puede consultar fichas individuales, filtrar por departamento/distrito/seccional y exportar resultados reales en PDF y Excel.',
    },
    {
      num: '04',
      title: 'Proyección de Votos sin Duplicación',
      body: 'Busque al coordinador por nombre, apellido, C.I. o seccional para cargar su estimación de votos. El sistema evita duplicar proyecciones por coordinador y responsable, calcula subtotales automáticos y rotula claramente los valores como estimaciones proyectadas.',
    },
    {
      num: '05',
      title: 'Agenda, Calendario y Documentos Oficiales',
      body: 'Organice reuniones políticas, audiencias, actividades parlamentarias y recorridos en vistas Mensual, Semanal y Diaria. Genere informes individuales de actividad y agendas diarias, semanales o mensuales en PDF con logotipo, cabecera y pie configurados.',
    },
    {
      num: '06',
      title: 'Personalización, Campos Dinámicos y Respaldos',
      body: 'En Administración General puede modificar el nombre de la organización, logotipo, colores institucionales, encabezados de reportes, campos personalizados para cada formulario y descargar o restaurar copias de seguridad completas de la base de datos.',
    },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          Guía Básica de Administración y Operación
        </h1>
        <p className="text-sm text-slate-600 mt-0.5">
          {settings.platform_name} · {settings.campaign_reference}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sections.map((s) => (
          <article key={s.num} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="text-xs font-mono font-bold text-slate-400">{s.num}</div>
            <h2 className="mt-1 text-base font-semibold text-slate-900">{s.title}</h2>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">{s.body}</p>
          </article>
        ))}
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-900">Instalación en Dispositivos Móviles (PWA)</h2>
        <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
          Esta plataforma está preparada como Aplicación Web Progresiva (PWA). En Android o Chrome/Edge de escritorio
          utilice el botón <strong>Instalar App</strong> de la barra superior. En iPhone o iPad (Safari), pulse{' '}
          <strong>Compartir</strong> y luego <strong>Agregar a inicio</strong> para utilizarla a pantalla completa.
        </p>
      </section>
    </div>
  );
};
