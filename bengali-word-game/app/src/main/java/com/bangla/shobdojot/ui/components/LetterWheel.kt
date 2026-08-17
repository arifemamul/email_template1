package com.bangla.shobdojot.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.toMutableStateList
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import com.bangla.shobdojot.ui.theme.Marigold
import com.bangla.shobdojot.ui.theme.SlateViolet
import com.bangla.shobdojot.ui.theme.TileInk
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.roundToInt
import kotlin.math.sin

/**
 * The letter wheel: tiles on a circle that the player drags a finger across to spell a
 * word. Dragging back onto the previous tile un-picks it, which is what players expect
 * after overshooting.
 *
 * The gesture lives entirely here - the parent only hears the word in progress
 * ([onWordChange]) and the word released ([onWordSubmit]).
 */
@Composable
fun LetterWheel(
    letters: List<String>,
    onWordChange: (String) -> Unit,
    onWordSubmit: (String) -> Unit,
    modifier: Modifier = Modifier,
    highlight: Color = Marigold
) {
    if (letters.isEmpty()) return

    BoxWithConstraints(modifier, contentAlignment = Alignment.Center) {
        val density = LocalDensity.current
        val diameter = minOf(maxWidth, maxHeight)
        val tileDp = when {
            letters.size <= 4 -> diameter * 0.30f
            letters.size <= 6 -> diameter * 0.26f
            else -> diameter * 0.21f
        }
        val tilePx = with(density) { tileDp.toPx() }
        val hitRadius = tilePx * 0.62f

        var wheelSize by remember { mutableStateOf(IntSize.Zero) }
        // Selection holds wheel indices, so a shuffle relabels tiles without confusing it.
        val selected = remember(letters) { mutableListOf<Int>().toMutableStateList() }
        var pointer by remember(letters) { mutableStateOf<Offset?>(null) }

        val centres: List<Offset> = remember(letters.size, wheelSize, tilePx) {
            if (wheelSize == IntSize.Zero) {
                emptyList()
            } else {
                val cx = wheelSize.width / 2f
                val cy = wheelSize.height / 2f
                val radius = minOf(cx, cy) - tilePx / 2f
                // One ring, first tile at the top, running clockwise.
                List(letters.size) { i ->
                    val angle = -PI / 2 + 2 * PI * i / letters.size
                    Offset(cx + (radius * cos(angle)).toFloat(), cy + (radius * sin(angle)).toFloat())
                }
            }
        }

        fun tileAt(position: Offset): Int? =
            centres.indexOfFirst { hypot(it.x - position.x, it.y - position.y) <= hitRadius }
                .takeIf { it >= 0 }

        fun currentWord() = selected.joinToString("") { letters[it] }

        Box(
            modifier = Modifier
                .fillMaxSize()
                .onSizeChanged { wheelSize = it }
                .drawBehind {
                    if (selected.isEmpty()) return@drawBehind
                    val stroke = tilePx * 0.14f
                    for (i in 0 until selected.size - 1) {
                        drawLine(
                            color = highlight,
                            start = centres[selected[i]],
                            end = centres[selected[i + 1]],
                            strokeWidth = stroke,
                            cap = StrokeCap.Round
                        )
                    }
                    pointer?.let { tip ->
                        drawLine(
                            color = highlight.copy(alpha = 0.5f),
                            start = centres[selected.last()],
                            end = tip,
                            strokeWidth = stroke,
                            cap = StrokeCap.Round
                        )
                    }
                }
                .pointerInput(letters, centres) {
                    if (centres.isEmpty()) return@pointerInput
                    detectDragGestures(
                        onDragStart = { start ->
                            selected.clear()
                            tileAt(start)?.let { selected.add(it) }
                            pointer = start
                            onWordChange(currentWord())
                        },
                        onDrag = { change, _ ->
                            change.consume()
                            pointer = change.position
                            val hit = tileAt(change.position)
                            if (hit != null) {
                                when {
                                    // Back onto the previous tile: undo the last pick.
                                    selected.size >= 2 && hit == selected[selected.size - 2] ->
                                        selected.removeAt(selected.lastIndex)

                                    hit !in selected -> selected.add(hit)
                                }
                                onWordChange(currentWord())
                            }
                        },
                        onDragEnd = {
                            val word = currentWord()
                            pointer = null
                            selected.clear()
                            onWordChange("")
                            if (word.isNotEmpty()) onWordSubmit(word)
                        },
                        onDragCancel = {
                            pointer = null
                            selected.clear()
                            onWordChange("")
                        }
                    )
                }
        ) {
            centres.forEachIndexed { index, centre ->
                val isSelected = index in selected
                Box(
                    modifier = Modifier
                        .offset {
                            IntOffset(
                                (centre.x - tilePx / 2f).roundToInt(),
                                (centre.y - tilePx / 2f).roundToInt()
                            )
                        }
                        .size(tileDp)
                        .clip(CircleShape)
                        .background(if (isSelected) highlight else SlateViolet),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = letters[index],
                        color = if (isSelected) TileInk else Marigold,
                        fontSize = with(density) { (tilePx * 0.40f).toSp() },
                        fontWeight = FontWeight.Bold,
                        maxLines = 1
                    )
                }
            }
        }
    }
}
