import type { TemplateCategory } from '../../types';

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  {
    id: 'readme',
    name: 'README',
    emoji: '📖',
    templates: [
      {
        id: 'readme-python',
        name: 'Python',
        description: 'README para proyecto Python',
        instruction:
          'Crea un README.md completo para un proyecto Python con secciones de descripción, instalación con pip/venv, uso con ejemplos de código, estructura de archivos, contribución y licencia MIT.',
      },
      {
        id: 'readme-nodejs',
        name: 'Node.js',
        description: 'README para proyecto Node.js',
        instruction:
          'Crea un README.md completo para un proyecto Node.js con secciones de descripción, instalación con npm, scripts disponibles, variables de entorno, uso con ejemplos, estructura de archivos y licencia MIT.',
      },
      {
        id: 'readme-datascience',
        name: 'Data Science',
        description: 'README para proyecto de ciencia de datos',
        instruction:
          'Crea un README.md para un proyecto de Data Science con secciones de descripción del dataset, requisitos (Python, Jupyter, pandas, numpy, scikit-learn), instalación, estructura del proyecto, metodología, resultados y cómo reproducir el análisis.',
      },
      {
        id: 'readme-react',
        name: 'React',
        description: 'README para proyecto React',
        instruction:
          'Crea un README.md completo para un proyecto React con Vite que incluya descripción, cómo iniciar en desarrollo (npm run dev), build para producción, variables de entorno necesarias, estructura de componentes, tecnologías usadas y licencia MIT.',
      },
      {
        id: 'readme-docs',
        name: 'Solo-docs',
        description: 'README mínimo de documentación',
        instruction:
          'Crea un README.md minimalista y elegante para un repositorio de documentación con secciones de descripción, cómo contribuir, cómo navegar el contenido y licencia CC BY 4.0.',
      },
    ],
  },
  {
    id: 'gitignore',
    name: '.gitignore',
    emoji: '🚫',
    templates: [
      {
        id: 'gitignore-python',
        name: 'Python',
        description: '.gitignore para Python',
        instruction:
          'Crea un archivo .gitignore completo para un proyecto Python que excluya: __pycache__, *.pyc, *.pyo, .env, venv/, .venv/, dist/, build/, *.egg-info/, .pytest_cache/, .mypy_cache/, .coverage, htmlcov/ y archivos de IDEs.',
      },
      {
        id: 'gitignore-node',
        name: 'Node.js',
        description: '.gitignore para Node.js',
        instruction:
          'Crea un archivo .gitignore para un proyecto Node.js que excluya: node_modules/, dist/, .env, .env.local, *.log, .DS_Store, coverage/, .nyc_output/ y archivos de IDEs como .vscode/ e .idea/.',
      },
      {
        id: 'gitignore-java',
        name: 'Java',
        description: '.gitignore para Java/Maven/Gradle',
        instruction:
          'Crea un .gitignore completo para un proyecto Java que excluya: *.class, *.jar, *.war, target/, build/, .gradle/, .idea/, *.iml, out/ y archivos de Maven y Gradle.',
      },
      {
        id: 'gitignore-react',
        name: 'React/Vite',
        description: '.gitignore para React con Vite',
        instruction:
          'Crea un .gitignore para un proyecto React con Vite que excluya: node_modules/, dist/, dist-ssr/, *.local, .env, .env.local, .env.production, .DS_Store, *.log y archivos de IDEs.',
      },
    ],
  },
  {
    id: 'licenses',
    name: 'Licencias',
    emoji: '⚖️',
    templates: [
      {
        id: 'license-mit',
        name: 'MIT',
        description: 'Licencia MIT',
        instruction:
          'Crea un archivo LICENSE con el texto completo de la licencia MIT para el año actual. Deja el nombre del autor como "[Tu Nombre]" para que el usuario lo personalice.',
      },
      {
        id: 'license-apache',
        name: 'Apache 2.0',
        description: 'Licencia Apache 2.0',
        instruction:
          'Crea un archivo LICENSE con el texto completo de la licencia Apache 2.0. Incluye el encabezado estándar con [nombre del proyecto] y [año] como marcadores para personalizar.',
      },
      {
        id: 'license-gpl',
        name: 'GPL 3.0',
        description: 'Licencia GNU GPL v3.0',
        instruction:
          'Crea un archivo LICENSE con el texto completo de la licencia GNU General Public License versión 3.0 (GPL-3.0). Incluye la nota estándar al inicio del archivo con el nombre del programa como marcador.',
      },
    ],
  },
];
