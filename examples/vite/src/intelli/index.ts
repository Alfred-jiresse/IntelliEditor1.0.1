// IntelliEditor's application layer: the UI around the conformity engine.
// The engine itself (`@intellieditor/conformity`) knows nothing about React or the editor.

export { ConformityProvider, useConformity } from './ConformityContext';
export { ConformityPanel } from './ConformityPanel';
export { IntelliHeaderActions } from './IntelliHeaderActions';
export { AcademicDialogs, AcademicInsertRows, type AcademicDialog } from './AcademicTools';
export { ACADEMIC_TEXT } from './labels';
export { fetchSample, SAMPLES, type SampleId } from './samples';
import './conformity.css';
