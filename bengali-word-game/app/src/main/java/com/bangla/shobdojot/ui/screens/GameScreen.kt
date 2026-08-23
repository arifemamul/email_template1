package com.bangla.shobdojot.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Lightbulb
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.bangla.shobdojot.data.GameRepository
import com.bangla.shobdojot.data.Levels
import com.bangla.shobdojot.logic.BanglaText
import com.bangla.shobdojot.ui.GameUiState
import com.bangla.shobdojot.ui.WordResult
import com.bangla.shobdojot.ui.components.CrosswordGrid
import com.bangla.shobdojot.ui.components.LetterWheel
import com.bangla.shobdojot.ui.components.WordPreview
import com.bangla.shobdojot.ui.theme.DeepIndigo
import com.bangla.shobdojot.ui.theme.LeafGreen
import com.bangla.shobdojot.ui.theme.Marigold
import com.bangla.shobdojot.ui.theme.MidIndigo
import com.bangla.shobdojot.ui.theme.SlateViolet
import kotlinx.coroutines.delay

/**
 * One level: board on top, traced word in the middle, wheel at the bottom.
 */
@Composable
fun GameScreen(
    state: GameUiState,
    onBack: () -> Unit,
    onSubmitWord: (String) -> WordResult,
    onHint: () -> Boolean,
    onShuffle: () -> Unit,
    onNextLevel: () -> Unit,
    onReplay: () -> Unit
) {
    val level = state.level ?: return
    val puzzle = state.puzzle ?: return

    var traced by remember(level.id) { mutableStateOf("") }
    // A submitted word stays on screen briefly so its verdict colour is readable.
    var verdict by remember(level.id) { mutableStateOf<Pair<String, WordResult>?>(null) }
    var feedbackTick by remember(level.id) { mutableStateOf(0) }
    var showComplete by remember(level.id) { mutableStateOf(false) }
    var noCoins by remember { mutableStateOf(false) }

    LaunchedEffect(verdict) {
        if (verdict != null) {
            delay(700)
            verdict = null
        }
    }

    LaunchedEffect(state.completed) {
        if (state.completed) {
            delay(650)
            showComplete = true
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(DeepIndigo)
            .padding(horizontal = 16.dp, vertical = 12.dp)
    ) {
        GameTopBar(
            levelId = level.id,
            coins = state.coins,
            foundCount = state.foundWords.size,
            totalCount = state.totalWords,
            onBack = onBack
        )

        Spacer(Modifier.height(8.dp))

        CrosswordGrid(
            puzzle = puzzle,
            revealed = state.revealedCells,
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
        )

        WordPreview(
            word = verdict?.first ?: traced,
            lastResult = verdict?.second,
            feedbackTick = feedbackTick,
            modifier = Modifier.fillMaxWidth()
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically
        ) {
            ActionButton(
                icon = Icons.Filled.Lightbulb,
                label = "সংকেত ${BanglaText.digits(GameRepository.HINT_COST)}",
                enabled = !state.completed
            ) {
                if (state.coins < GameRepository.HINT_COST) noCoins = true else onHint()
            }
            Spacer(Modifier.width(10.dp))
            ActionButton(icon = Icons.Filled.Refresh, label = "এলোমেলো", enabled = true) {
                onShuffle()
            }
        }

        Spacer(Modifier.height(4.dp))

        LetterWheel(
            letters = state.wheelLetters,
            onWordChange = { traced = it },
            onWordSubmit = { word ->
                val result = onSubmitWord(word)
                verdict = word to result
                feedbackTick++
            },
            modifier = Modifier
                .fillMaxWidth()
                .weight(1.1f)
        )
    }

    if (showComplete) {
        LevelCompleteDialog(
            levelId = level.id,
            coins = state.coins,
            hasNext = level.id < Levels.count,
            onNext = {
                showComplete = false
                onNextLevel()
            },
            onReplay = {
                showComplete = false
                onReplay()
            },
            onHome = {
                showComplete = false
                onBack()
            }
        )
    }

    if (noCoins) {
        AlertDialog(
            onDismissRequest = { noCoins = false },
            containerColor = MidIndigo,
            title = { Text("যথেষ্ট কয়েন নেই", color = Marigold, fontWeight = FontWeight.Bold) },
            text = {
                Text(
                    "সংকেতের জন্য ${BanglaText.digits(GameRepository.HINT_COST)} কয়েন লাগে। " +
                        "শব্দ খুঁজে কয়েন জমাও।",
                    color = MaterialTheme.colorScheme.onSurface
                )
            },
            confirmButton = {
                TextButton(onClick = { noCoins = false }) { Text("ঠিক আছে", color = Marigold) }
            }
        )
    }
}

@Composable
private fun GameTopBar(
    levelId: Int,
    coins: Int,
    foundCount: Int,
    totalCount: Int,
    onBack: () -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(CircleShape)
                .background(MidIndigo)
                .clickable(onClick = onBack),
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "পিছনে", tint = Marigold)
        }

        Spacer(Modifier.width(12.dp))

        Column(Modifier.weight(1f)) {
            Text(
                text = "লেভেল ${BanglaText.digits(levelId)}",
                color = MaterialTheme.colorScheme.onBackground,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "${BanglaText.digits(foundCount)} / ${BanglaText.digits(totalCount)} শব্দ",
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f),
                fontSize = 13.sp
            )
        }

        CoinPill(coins)
    }
}

@Composable
fun CoinPill(coins: Int, modifier: Modifier = Modifier) {
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(50))
            .background(MidIndigo)
            .padding(horizontal = 14.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(16.dp)
                .clip(CircleShape)
                .background(Marigold)
        )
        Spacer(Modifier.width(8.dp))
        Text(
            text = BanglaText.digits(coins),
            color = Marigold,
            fontWeight = FontWeight.Bold,
            fontSize = 16.sp
        )
    }
}

@Composable
private fun ActionButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    enabled: Boolean,
    onClick: () -> Unit
) {
    val alpha = if (enabled) 1f else 0.4f
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(50))
            .background(MidIndigo.copy(alpha = alpha))
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(icon, contentDescription = null, tint = Marigold.copy(alpha = alpha))
        Spacer(Modifier.width(8.dp))
        Text(
            text = label,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = alpha),
            fontSize = 14.sp,
            fontWeight = FontWeight.Medium
        )
    }
}

@Composable
private fun LevelCompleteDialog(
    levelId: Int,
    coins: Int,
    hasNext: Boolean,
    onNext: () -> Unit,
    onReplay: () -> Unit,
    onHome: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onHome,
        containerColor = MidIndigo,
        title = {
            Text(
                text = "দারুণ! লেভেল ${BanglaText.digits(levelId)} শেষ",
                color = LeafGreen,
                fontWeight = FontWeight.Bold
            )
        },
        text = {
            Text(
                text = "সব শব্দ খুঁজে পেয়েছ। এখন তোমার কয়েন ${BanglaText.digits(coins)}।",
                color = MaterialTheme.colorScheme.onSurface
            )
        },
        confirmButton = {
            if (hasNext) {
                TextButton(onClick = onNext) {
                    Text("পরের লেভেল", color = Marigold, fontWeight = FontWeight.Bold)
                }
            } else {
                TextButton(onClick = onHome) {
                    Text("হোমে ফিরে যাও", color = Marigold, fontWeight = FontWeight.Bold)
                }
            }
        },
        dismissButton = {
            TextButton(onClick = onReplay) {
                Text("আবার খেলো", color = MaterialTheme.colorScheme.onSurface)
            }
        }
    )
}
