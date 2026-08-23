package com.bangla.shobdojot.ui.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.bangla.shobdojot.ui.WordResult
import com.bangla.shobdojot.ui.theme.Coral
import com.bangla.shobdojot.ui.theme.LeafGreen
import com.bangla.shobdojot.ui.theme.Marigold
import com.bangla.shobdojot.ui.theme.TileInk

/**
 * The word being traced, shown above the wheel. A rejected word shakes rather than
 * printing an error - faster to read mid-drag, and it needs no translation.
 */
@Composable
fun WordPreview(
    word: String,
    lastResult: WordResult?,
    feedbackTick: Int,
    modifier: Modifier = Modifier
) {
    val shake = remember { Animatable(0f) }

    LaunchedEffect(feedbackTick) {
        if (feedbackTick == 0) return@LaunchedEffect
        if (lastResult == WordResult.WRONG || lastResult == WordResult.ALREADY_FOUND) {
            // Three quick swings, then settle back to centre.
            for (offset in listOf(14f, -12f, 9f, -6f, 0f)) {
                shake.animateTo(offset, tween(durationMillis = 55))
            }
        }
    }

    Box(modifier.height(52.dp), contentAlignment = Alignment.Center) {
        if (word.isEmpty()) {
            Text(
                text = "অক্ষর জুড়ে শব্দ বানাও",
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.55f),
                fontSize = 15.sp
            )
        } else {
            val background = when (lastResult) {
                WordResult.CORRECT -> LeafGreen
                WordResult.ALREADY_FOUND -> Marigold
                WordResult.WRONG -> Coral
                null -> Marigold
            }
            Box(
                modifier = Modifier
                    .graphicsLayer { translationX = shake.value }
                    .clip(RoundedCornerShape(50))
                    .background(background)
                    .padding(horizontal = 22.dp, vertical = 8.dp)
            ) {
                Text(
                    text = word,
                    color = TileInk,
                    fontSize = 28.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1
                )
            }
        }
    }
}
