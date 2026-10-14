import {Text, View} from 'react-native';
import type {TestId} from '@catering-v2s/ui-base-primitives';
import {styles} from './testExpoAppStyles';

export const HostStateCard = ({
  kind,
  title,
  description,
  testID,
}: Readonly<{
  readonly kind: 'error' | 'pending';
  readonly title: string;
  readonly description: string;
  readonly testID: TestId;
}>) => (
  <View style={[styles.hostStateCard, kind === 'error' ? styles.hostErrorCard : styles.hostPendingCard]}>
    <View style={[styles.stateGlyph, kind === 'error' ? styles.errorGlyph : styles.pendingGlyph]}>
      {kind === 'error' ? (
        <Text style={styles.errorGlyphText}>!</Text>
      ) : (
        <Text style={styles.pendingGlyphText}>···</Text>
      )}
    </View>
    <View style={styles.hostStateCopy}>
      <Text style={styles.hostStateTitle} testID={testID}>
        {title}
      </Text>
      <Text style={styles.hostStateDescription}>{description}</Text>
    </View>
  </View>
);

