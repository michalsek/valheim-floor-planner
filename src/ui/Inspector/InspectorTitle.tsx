import styles from './Inspector.module.css';

export const InspectorTitle = ({ title }: { title: string }) => (
  <h2 className={styles.title}>{title}</h2>
);
